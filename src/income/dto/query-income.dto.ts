import { IsDateString, IsOptional } from 'class-validator';

export class QueryIncomeDto {
  /** Inclusive lower bound (ISO-8601). */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Inclusive upper bound (ISO-8601). */
  @IsOptional()
  @IsDateString()
  to?: string;
}
