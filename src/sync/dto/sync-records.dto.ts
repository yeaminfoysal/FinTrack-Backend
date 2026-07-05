import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LoanDirection, LoanStatus } from '../../generated/prisma/client';

/** Fields shared by every synced record (Sync Architecture). */
abstract class BaseSyncRecord {
  @IsUUID()
  id!: string;

  @IsBoolean()
  isDeleted!: boolean;

  @IsOptional()
  @IsDateString()
  deletedAt?: string;

  @IsDateString()
  createdAt!: string;

  /** Authority timestamp used for Last-Write-Wins conflict resolution. */
  @IsDateString()
  updatedAt!: string;
}

export class IncomeSyncDto extends BaseSyncRecord {
  @IsInt()
  @Min(0)
  amount!: number;

  @IsString()
  @MaxLength(120)
  source!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ExpenseSyncDto extends BaseSyncRecord {
  @IsInt()
  @Min(0)
  amount!: number;

  @IsString()
  @MaxLength(60)
  category!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class LoanSyncDto extends BaseSyncRecord {
  @IsEnum(LoanDirection)
  direction!: LoanDirection;

  @IsString()
  @MaxLength(120)
  personName!: string;

  @IsInt()
  @Min(0)
  amount!: number;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsEnum(LoanStatus)
  status!: LoanStatus;

  @IsOptional()
  @IsDateString()
  settledDate?: string;
}

export class MonthlySummarySyncDto extends BaseSyncRecord {
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

  @IsInt()
  untrackedExpense!: number;

  @IsInt()
  monthlySaving!: number;

  @IsInt()
  closingBalance!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  practicalBalance?: number;
}
