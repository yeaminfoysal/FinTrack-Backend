import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateIncomeDto {
  /** Optional client-generated UUID (Modification #4). Generated server-side if omitted. */
  @IsOptional()
  @IsUUID()
  id?: string;

  /** Integer paisa (Modification #1). */
  @IsInt()
  @Min(1)
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
