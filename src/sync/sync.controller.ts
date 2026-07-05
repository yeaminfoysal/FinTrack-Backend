import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SyncService } from './sync.service';
import { PushDto } from './dto/push.dto';
import { PullQueryDto } from './dto/pull-query.dto';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @HttpCode(HttpStatus.OK)
  @Post('push')
  push(@CurrentUser('userId') userId: string, @Body() dto: PushDto) {
    return this.syncService.push(userId, dto);
  }

  @Get('pull')
  pull(@CurrentUser('userId') userId: string, @Query() query: PullQueryDto) {
    return this.syncService.pull(userId, query);
  }
}
