import { IsDateString, IsOptional } from 'class-validator';

export class SettleLoanDto {
  /** When the loan was settled (Returned/Paid). Defaults to now if omitted. */
  @IsOptional()
  @IsDateString()
  settledDate?: string;
}
