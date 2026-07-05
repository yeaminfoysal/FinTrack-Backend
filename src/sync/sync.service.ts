import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncStatus } from '../generated/prisma/client';
import { PushDto } from './dto/push.dto';
import { PullQueryDto } from './dto/pull-query.dto';
import {
  ExpenseSyncDto,
  IncomeSyncDto,
  LoanSyncDto,
  MonthlySummarySyncDto,
} from './dto/sync-records.dto';

export interface EntityResult {
  applied: number;
  skipped: number;
}

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  /** Push: client -> server. Conflicts resolved by Last-Write-Wins on updatedAt. */
  async push(userId: string, dto: PushDto) {
    const incomes = await this.applyAll(dto.incomes, (r) =>
      this.applyIncome(userId, r),
    );
    const expenses = await this.applyAll(dto.expenses, (r) =>
      this.applyExpense(userId, r),
    );
    const loans = await this.applyAll(dto.loans, (r) =>
      this.applyLoan(userId, r),
    );
    const monthlySummaries = await this.applyAll(dto.monthlySummaries, (r) =>
      this.applyMonthlySummary(userId, r),
    );

    return {
      serverTime: new Date().toISOString(),
      result: { incomes, expenses, loans, monthlySummaries },
    };
  }

  /** Pull: server -> client. Returns everything changed after `since`, tombstones included. */
  async pull(userId: string, query: PullQueryDto) {
    const where = query.since
      ? { userId, updatedAt: { gt: new Date(query.since) } }
      : { userId };

    const [incomes, expenses, loans, monthlySummaries] = await Promise.all([
      this.prisma.income.findMany({ where }),
      this.prisma.expense.findMany({ where }),
      this.prisma.loan.findMany({ where }),
      this.prisma.monthlySummary.findMany({ where }),
    ]);

    return {
      serverTime: new Date().toISOString(),
      incomes,
      expenses,
      loans,
      monthlySummaries,
    };
  }

  private async applyAll<T>(
    records: T[] | undefined,
    apply: (record: T) => Promise<boolean>,
  ): Promise<EntityResult> {
    const result: EntityResult = { applied: 0, skipped: 0 };
    for (const record of records ?? []) {
      if (await apply(record)) {
        result.applied += 1;
      } else {
        result.skipped += 1;
      }
    }
    return result;
  }

  /** @returns true if written, false if skipped (not owner / server copy is newer). */
  private async applyIncome(
    userId: string,
    rec: IncomeSyncDto,
  ): Promise<boolean> {
    const updatedAt = new Date(rec.updatedAt);
    const existing = await this.prisma.income.findUnique({
      where: { id: rec.id },
      select: { userId: true, updatedAt: true },
    });
    if (existing && (existing.userId !== userId || existing.updatedAt >= updatedAt)) {
      return false;
    }
    const data = {
      amount: BigInt(rec.amount),
      source: rec.source,
      date: new Date(rec.date),
      note: rec.note ?? null,
      isDeleted: rec.isDeleted,
      deletedAt: rec.deletedAt ? new Date(rec.deletedAt) : null,
      updatedAt,
      syncStatus: SyncStatus.SYNCED,
    };
    await this.prisma.income.upsert({
      where: { id: rec.id },
      update: data,
      create: { id: rec.id, userId, createdAt: new Date(rec.createdAt), ...data },
    });
    return true;
  }

  private async applyExpense(
    userId: string,
    rec: ExpenseSyncDto,
  ): Promise<boolean> {
    const updatedAt = new Date(rec.updatedAt);
    const existing = await this.prisma.expense.findUnique({
      where: { id: rec.id },
      select: { userId: true, updatedAt: true },
    });
    if (existing && (existing.userId !== userId || existing.updatedAt >= updatedAt)) {
      return false;
    }
    const data = {
      amount: BigInt(rec.amount),
      category: rec.category,
      date: new Date(rec.date),
      description: rec.description ?? null,
      isDeleted: rec.isDeleted,
      deletedAt: rec.deletedAt ? new Date(rec.deletedAt) : null,
      updatedAt,
      syncStatus: SyncStatus.SYNCED,
    };
    await this.prisma.expense.upsert({
      where: { id: rec.id },
      update: data,
      create: { id: rec.id, userId, createdAt: new Date(rec.createdAt), ...data },
    });
    return true;
  }

  private async applyLoan(userId: string, rec: LoanSyncDto): Promise<boolean> {
    const updatedAt = new Date(rec.updatedAt);
    const existing = await this.prisma.loan.findUnique({
      where: { id: rec.id },
      select: { userId: true, updatedAt: true },
    });
    if (existing && (existing.userId !== userId || existing.updatedAt >= updatedAt)) {
      return false;
    }
    const data = {
      direction: rec.direction,
      personName: rec.personName,
      amount: BigInt(rec.amount),
      date: new Date(rec.date),
      note: rec.note ?? null,
      status: rec.status,
      settledDate: rec.settledDate ? new Date(rec.settledDate) : null,
      isDeleted: rec.isDeleted,
      deletedAt: rec.deletedAt ? new Date(rec.deletedAt) : null,
      updatedAt,
      syncStatus: SyncStatus.SYNCED,
    };
    await this.prisma.loan.upsert({
      where: { id: rec.id },
      update: data,
      create: { id: rec.id, userId, createdAt: new Date(rec.createdAt), ...data },
    });
    return true;
  }

  /** Keyed by (userId, year, month) so re-closing a month overwrites, not duplicates. */
  private async applyMonthlySummary(
    userId: string,
    rec: MonthlySummarySyncDto,
  ): Promise<boolean> {
    const updatedAt = new Date(rec.updatedAt);
    const existing = await this.prisma.monthlySummary.findUnique({
      where: { userId_year_month: { userId, year: rec.year, month: rec.month } },
      select: { updatedAt: true },
    });
    if (existing && existing.updatedAt >= updatedAt) {
      return false;
    }
    const data = {
      openingBalance: BigInt(rec.openingBalance),
      totalIncome: BigInt(rec.totalIncome),
      totalDailyExpense: BigInt(rec.totalDailyExpense),
      outstandingLent: BigInt(rec.outstandingLent),
      outstandingBorrowed: BigInt(rec.outstandingBorrowed),
      untrackedExpense: BigInt(rec.untrackedExpense),
      monthlySaving: BigInt(rec.monthlySaving),
      closingBalance: BigInt(rec.closingBalance),
      practicalBalance:
        rec.practicalBalance === undefined ? null : BigInt(rec.practicalBalance),
      isDeleted: rec.isDeleted,
      deletedAt: rec.deletedAt ? new Date(rec.deletedAt) : null,
      updatedAt,
      syncStatus: SyncStatus.SYNCED,
    };
    await this.prisma.monthlySummary.upsert({
      where: { userId_year_month: { userId, year: rec.year, month: rec.month } },
      update: data,
      create: {
        id: rec.id,
        userId,
        year: rec.year,
        month: rec.month,
        createdAt: new Date(rec.createdAt),
        ...data,
      },
    });
    return true;
  }
}
