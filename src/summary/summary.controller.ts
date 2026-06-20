import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SummaryService } from './summary.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { MonthlyQueryDto } from './dto/monthly-query.dto';

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
}
