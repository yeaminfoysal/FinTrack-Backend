import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoanStatus, Prisma } from '../generated/prisma/client';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { SettleLoanDto } from './dto/settle-loan.dto';
import { QueryLoanDto } from './dto/query-loan.dto';

@Injectable()
export class LoanService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateLoanDto) {
    const now = new Date();
    return this.prisma.loan.create({
      data: {
        id: dto.id ?? randomUUID(),
        userId,
        direction: dto.direction,
        personName: dto.personName,
        amount: BigInt(dto.amount),
        date: new Date(dto.date),
        note: dto.note ?? null,
        status: LoanStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  findAll(userId: string, query: QueryLoanDto) {
    const where: Prisma.LoanWhereInput = { userId, isDeleted: false };
    if (query.direction) where.direction = query.direction;
    if (query.status) where.status = query.status;
    return this.prisma.loan.findMany({ where, orderBy: { date: 'desc' } });
  }

  async findOne(userId: string, id: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id, userId, isDeleted: false },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }
    return loan;
  }

  async update(userId: string, id: string, dto: UpdateLoanDto) {
    await this.findOne(userId, id);
    return this.prisma.loan.update({
      where: { id },
      data: {
        personName: dto.personName,
        amount: dto.amount === undefined ? undefined : BigInt(dto.amount),
        date: dto.date === undefined ? undefined : new Date(dto.date),
        note: dto.note,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Settle a loan (LENT -> Returned, BORROWED -> Paid). Removes it from the
   * outstanding running total; cash reconciliation stays correct (Loan v3).
   */
  async settle(userId: string, id: string, dto: SettleLoanDto) {
    const loan = await this.findOne(userId, id);
    if (loan.status === LoanStatus.SETTLED) {
      throw new BadRequestException('Loan is already settled');
    }
    const now = new Date();
    return this.prisma.loan.update({
      where: { id },
      data: {
        status: LoanStatus.SETTLED,
        settledDate: dto.settledDate ? new Date(dto.settledDate) : now,
        updatedAt: now,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    const now = new Date();
    return this.prisma.loan.update({
      where: { id },
      data: { isDeleted: true, deletedAt: now, updatedAt: now },
    });
  }
}
