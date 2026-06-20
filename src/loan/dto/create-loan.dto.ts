import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { LoanDirection } from '../../generated/prisma/client';

export class CreateLoanDto {
  /** Optional client-generated UUID (Modification #4). Generated server-side if omitted. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsEnum(LoanDirection)
  direction!: LoanDirection;

  @IsString()
  @MaxLength(120)
  personName!: string;

  /** Integer paisa (Modification #1). */
  @IsInt()
  @Min(1)
  amount!: number;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
