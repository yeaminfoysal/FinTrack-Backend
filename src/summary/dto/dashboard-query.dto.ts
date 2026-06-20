import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(3000)
  year?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  /** Current practical balance in integer paisa (Practical Balance Module). */
  @IsOptional()
  @IsInt()
  @Min(0)
  practicalBalance?: number;
}
