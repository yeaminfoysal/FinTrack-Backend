import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  /** Initial opening savings in integer paisa (Modification #1). */
  @IsOptional()
  @IsInt()
  @Min(0)
  openingSavings?: number;
}
