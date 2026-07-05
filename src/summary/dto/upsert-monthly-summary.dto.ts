import {
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/**
 * Client-computed month-close snapshot (Modification #6 — client is the authority).
 * All monetary values are integer paisa. Balances / saving / untracked may be
 * negative; income/expense/loan totals must be non-negative.
 */
export class UpsertMonthlySummaryDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsInt()
  @Min(2000)
  @Max(3000)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsInt()
  openingBalance!: number;

  @IsInt()
  @Min(0)
  totalIncome!: number;

  @IsInt()
  @Min(0)
  totalDailyExpense!: number;

  @IsInt()
  @Min(0)
  outstandingLent!: number;

  @IsInt()
  @Min(0)
  outstandingBorrowed!: number;

  /** May be negative (untracked income). */
  @IsInt()
  untrackedExpense!: number;

  /** May be negative. */
  @IsInt()
  monthlySaving!: number;

  /** May be negative. */
  @IsInt()
  closingBalance!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  practicalBalance?: number;
}
