import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoanDirection, LoanStatus, SyncStatus } from '../generated/prisma/client';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { MonthlyQueryDto } from './dto/monthly-query.dto';
import { UpsertMonthlySummaryDto } from './dto/upsert-monthly-summary.dto';

interface DateFilter {
  gte?: Date;
  lt?: Date;
}

interface MonthAggregate {
  income: bigint;
  expense: bigint;
}

/**
 * Backend cross-check calculations (Modification #6 — the client is the authority).
 * Implements the canonical formulas from CLAUDE.md "Calculation Definitions":
 *   Theoretical = Opening + Income + OutstandingBorrowed − DailyExpense − OutstandingLent   (§B)
 *   Untracked   = Theoretical − Practical                                                    (§C)
 *   Saving      = Income − (DailyExpense + Untracked)                                        (§D)
 * Loans are a live global running total and are NOT folded into the opening chain (§E).
 */
@Injectable()
export class SummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(userId: string, query: DashboardQueryDto) {
    const now = new Date();
    const year = query.year ?? now.getUTCFullYear();
    const month = query.month ?? now.getUTCMonth() + 1;
    const { start, end } = this.monthRange(year, month);

    const openingSavings = await this.getOpeningSavings(userId);
    const totalIncome = await this.incomeSum(userId);
    const totalDailyExpense = await this.expenseSum(userId);
    const monthIncome = await this.incomeSum(userId, { gte: start, lt: end });
    const monthDailyExpense = await this.expenseSum(userId, {
      gte: start,
      lt: end,
    });
    const { lent, borrowed } = await this.outstanding(userId);

    // §B (all-time form for the live "Current Balance").
    const theoreticalBalance =
      openingSavings + totalIncome + borrowed - totalDailyExpense - lent;

    let practicalBalance: bigint | null = null;
    let untrackedGap = 0n; // signed: positive = expense, negative = income
    let netWorth: bigint | null = null;
    if (query.practicalBalance !== undefined) {
      practicalBalance = BigInt(query.practicalBalance);
      untrackedGap = theoreticalBalance - practicalBalance; // §C
      netWorth = practicalBalance + lent - borrowed; // Net Worth (Loan v3)
    }

    const monthlySaving = monthIncome - monthDailyExpense - untrackedGap; // §D
    const untrackedExpense = untrackedGap > 0n ? untrackedGap : 0n;
    const untrackedIncome = untrackedGap < 0n ? -untrackedGap : 0n;
    const totalExpense = monthDailyExpense + lent + untrackedExpense; // §F

    return {
      period: { year, month },
      openingSavings,
      currentBalance: theoreticalBalance,
      theoreticalBalance,
      practicalBalance,
      currentMonthIncome: monthIncome,
      currentMonthExpense: monthDailyExpense,
      outstandingLent: lent,
      outstandingBorrowed: borrowed,
      untrackedExpense,
      untrackedIncome,
      currentMonthSaving: monthlySaving,
      totalExpense,
      netWorth,
    };
  }

  /**
   * Tracked monthly cross-check. Opening is the savings-ledger opening
   * (initial savings + tracked income − tracked expense before the month).
   * NOTE: per-month untracked folding (§E) needs historical month-end practical
   * snapshots, which the client maintains; backend reports the tracked view.
   */
  async monthly(userId: string, query: MonthlyQueryDto) {
    const { year, month } = query;
    const { start, end } = this.monthRange(year, month);

    const openingSavings = await this.getOpeningSavings(userId);
    const incomeBefore = await this.incomeSum(userId, { lt: start });
    const expenseBefore = await this.expenseSum(userId, { lt: start });
    const openingBalance = openingSavings + incomeBefore - expenseBefore;

    const totalIncome = await this.incomeSum(userId, { gte: start, lt: end });
    const totalDailyExpense = await this.expenseSum(userId, {
      gte: start,
      lt: end,
    });
    const monthlySaving = totalIncome - totalDailyExpense;
    const closingBalance = openingBalance + monthlySaving;
    const { lent, borrowed } = await this.outstanding(userId);

    return {
      period: { year, month },
      openingBalance,
      totalIncome,
      totalDailyExpense,
      outstandingLent: lent,
      outstandingBorrowed: borrowed,
      monthlySaving,
      closingBalance,
    };
  }

  /**
   * All-months history (History Module — Saving History): per-month income,
   * daily expense, untracked, saving, and the carry-forward opening/closing chain.
   * Untracked for a month comes from a stored MonthlySummary (pushed by the client
   * at month-close); months without one report untracked = 0 (§E fold still applies).
   * Returned chronologically (oldest first) so the opening/closing chain reads top-down.
   */
  async history(userId: string) {
    const [incomes, expenses, summaries, openingSavings] = await Promise.all([
      this.prisma.income.findMany({
        where: { userId, isDeleted: false },
        select: { amount: true, date: true },
      }),
      this.prisma.expense.findMany({
        where: { userId, isDeleted: false },
        select: { amount: true, date: true },
      }),
      this.prisma.monthlySummary.findMany({
        where: { userId, isDeleted: false },
        select: { year: true, month: true, untrackedExpense: true },
      }),
      this.getOpeningSavings(userId),
    ]);

    const aggregates = new Map<string, MonthAggregate>();
    const ensure = (key: string): MonthAggregate => {
      let agg = aggregates.get(key);
      if (!agg) {
        agg = { income: 0n, expense: 0n };
        aggregates.set(key, agg);
      }
      return agg;
    };
    const keyOf = (date: Date): string => {
      const d = new Date(date);
      return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    };

    for (const income of incomes) {
      ensure(keyOf(income.date)).income += income.amount;
    }
    for (const expense of expenses) {
      ensure(keyOf(expense.date)).expense += expense.amount;
    }

    const untrackedByKey = new Map<string, bigint>();
    for (const summary of summaries) {
      const key = `${summary.year}-${summary.month}`;
      untrackedByKey.set(key, summary.untrackedExpense);
      ensure(key); // surface months that only have a closing summary
    }

    const keys = [...aggregates.keys()].sort((a, b) => {
      const [ay, am] = a.split('-').map(Number);
      const [by, bm] = b.split('-').map(Number);
      return ay - by || am - bm;
    });

    let opening = openingSavings;
    const months = keys.map((key) => {
      const [year, month] = key.split('-').map(Number);
      const { income, expense } = aggregates.get(key)!;
      const untrackedExpense = untrackedByKey.get(key) ?? 0n;
      const monthlySaving = income - expense - untrackedExpense; // §D
      const openingBalance = opening;
      const closingBalance = opening + monthlySaving; // §E carry-forward
      opening = closingBalance;
      return {
        year,
        month,
        totalIncome: income,
        totalDailyExpense: expense,
        untrackedExpense,
        monthlySaving,
        openingBalance,
        closingBalance,
      };
    });

    return { months };
  }

  /**
   * Stores a client-computed month-close summary (Monthly Closing System,
   * Modification #8/#11). Upserts by (userId, year, month) so re-closing /
   * backdated recompute is idempotent. Once stored, /summary/history can show
   * that month's real untracked expense and untracked-folded saving.
   */
  async upsertMonthly(userId: string, dto: UpsertMonthlySummaryDto) {
    const now = new Date();
    const data = {
      openingBalance: BigInt(dto.openingBalance),
      totalIncome: BigInt(dto.totalIncome),
      totalDailyExpense: BigInt(dto.totalDailyExpense),
      outstandingLent: BigInt(dto.outstandingLent),
      outstandingBorrowed: BigInt(dto.outstandingBorrowed),
      untrackedExpense: BigInt(dto.untrackedExpense),
      monthlySaving: BigInt(dto.monthlySaving),
      closingBalance: BigInt(dto.closingBalance),
      practicalBalance:
        dto.practicalBalance === undefined
          ? null
          : BigInt(dto.practicalBalance),
      isDeleted: false,
      deletedAt: null,
      syncStatus: SyncStatus.SYNCED,
      updatedAt: now,
    };
    return this.prisma.monthlySummary.upsert({
      where: {
        userId_year_month: { userId, year: dto.year, month: dto.month },
      },
      update: data,
      create: {
        id: dto.id ?? randomUUID(),
        userId,
        year: dto.year,
        month: dto.month,
        createdAt: now,
        ...data,
      },
    });
  }

  private async getOpeningSavings(userId: string): Promise<bigint> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { openingSavings: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.openingSavings;
  }

  private async incomeSum(userId: string, date?: DateFilter): Promise<bigint> {
    const result = await this.prisma.income.aggregate({
      _sum: { amount: true },
      where: { userId, isDeleted: false, ...(date ? { date } : {}) },
    });
    return result._sum.amount ?? 0n;
  }

  private async expenseSum(userId: string, date?: DateFilter): Promise<bigint> {
    const result = await this.prisma.expense.aggregate({
      _sum: { amount: true },
      where: { userId, isDeleted: false, ...(date ? { date } : {}) },
    });
    return result._sum.amount ?? 0n;
  }

  private async outstanding(
    userId: string,
  ): Promise<{ lent: bigint; borrowed: bigint }> {
    const grouped = await this.prisma.loan.groupBy({
      by: ['direction'],
      where: { userId, isDeleted: false, status: LoanStatus.ACTIVE },
      _sum: { amount: true },
    });
    let lent = 0n;
    let borrowed = 0n;
    for (const row of grouped) {
      const amount = row._sum.amount ?? 0n;
      if (row.direction === LoanDirection.LENT) {
        lent = amount;
      } else if (row.direction === LoanDirection.BORROWED) {
        borrowed = amount;
      }
    }
    return { lent, borrowed };
  }

  /** Month range in UTC: [start of month, start of next month). */
  private monthRange(year: number, month: number): { start: Date; end: Date } {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return { start, end };
  }
}
