import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SummaryService } from './summary.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { MonthlyQueryDto } from './dto/monthly-query.dto';
import { UpsertMonthlySummaryDto } from './dto/upsert-monthly-summary.dto';

@Controller('summary')
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get('dashboard')
  dashboard(
    @CurrentUser('userId') userId: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.summaryService.dashboard(userId, query);
  }

  @Get('monthly')
  monthly(
    @CurrentUser('userId') userId: string,
    @Query() query: MonthlyQueryDto,
  ) {
    return this.summaryService.monthly(userId, query);
  }

  @Get('history')
  history(@CurrentUser('userId') userId: string) {
    return this.summaryService.history(userId);
  }

  /** Month-close: store the client-computed summary for a month (idempotent upsert). */
  @Put('monthly')
  upsertMonthly(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpsertMonthlySummaryDto,
  ) {
    return this.summaryService.upsertMonthly(userId, dto);
  }
}
