import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import {
  ExpenseSyncDto,
  IncomeSyncDto,
  LoanSyncDto,
  MonthlySummarySyncDto,
} from './sync-records.dto';

export class PushDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncomeSyncDto)
  incomes?: IncomeSyncDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseSyncDto)
  expenses?: ExpenseSyncDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LoanSyncDto)
  loans?: LoanSyncDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MonthlySummarySyncDto)
  monthlySummaries?: MonthlySummarySyncDto[];
}
