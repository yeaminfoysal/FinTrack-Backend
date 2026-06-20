import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoanDirection, LoanStatus } from '../generated/prisma/client';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { MonthlyQueryDto } from './dto/monthly-query.dto';

interface DateFilter {
  gte?: Date;
  lt?: Date;
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
