import { IsEnum, IsOptional } from 'class-validator';
import { LoanDirection, LoanStatus } from '../../generated/prisma/client';

export class QueryLoanDto {
  @IsOptional()
  @IsEnum(LoanDirection)
  direction?: LoanDirection;

  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;
}
