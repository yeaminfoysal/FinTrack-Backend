import { IsDateString, IsOptional } from 'class-validator';

export class PullQueryDto {
  /** Return everything changed after this ISO-8601 timestamp (lastSyncedAt). */
  @IsOptional()
  @IsDateString()
  since?: string;
}
