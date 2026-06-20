import { IsInt, Max, Min } from 'class-validator';

export class MonthlyQueryDto {
  @IsInt()
  @Min(2000)
  @Max(3000)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}
