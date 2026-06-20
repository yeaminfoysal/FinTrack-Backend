import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class QueryExpenseDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;
}
