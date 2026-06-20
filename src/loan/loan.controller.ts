import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LoanService } from './loan.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { SettleLoanDto } from './dto/settle-loan.dto';
import { QueryLoanDto } from './dto/query-loan.dto';

@Controller('loans')
export class LoanController {
  constructor(private readonly loanService: LoanService) {}

  @Post()
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateLoanDto) {
    return this.loanService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('userId') userId: string, @Query() query: QueryLoanDto) {
    return this.loanService.findAll(userId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.loanService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLoanDto,
  ) {
    return this.loanService.update(userId, id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/settle')
  settle(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettleLoanDto,
  ) {
    return this.loanService.settle(userId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.loanService.remove(userId, id);
  }
}
