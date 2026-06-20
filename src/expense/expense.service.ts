import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpenseDto } from './dto/query-expense.dto';

@Injectable()
export class ExpenseService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateExpenseDto) {
    const now = new Date();
    return this.prisma.expense.create({
      data: {
        id: dto.id ?? randomUUID(),
        userId,
        amount: BigInt(dto.amount),
        category: dto.category,
        date: new Date(dto.date),
        description: dto.description ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  findAll(userId: string, query: QueryExpenseDto) {
    const where: Prisma.ExpenseWhereInput = { userId, isDeleted: false };
    if (query.category) where.category = query.category;
    if (query.from || query.to) {
      where.date = {};
      if (query.from) where.date.gte = new Date(query.from);
      if (query.to) where.date.lte = new Date(query.to);
    }
    return this.prisma.expense.findMany({ where, orderBy: { date: 'desc' } });
  }

  async findOne(userId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, userId, isDeleted: false },
    });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    return expense;
  }

  async update(userId: string, id: string, dto: UpdateExpenseDto) {
    await this.findOne(userId, id);
    return this.prisma.expense.update({
      where: { id },
      data: {
        amount: dto.amount === undefined ? undefined : BigInt(dto.amount),
        category: dto.category,
        date: dto.date === undefined ? undefined : new Date(dto.date),
        description: dto.description,
        updatedAt: new Date(),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    const now = new Date();
    return this.prisma.expense.update({
      where: { id },
      data: { isDeleted: true, deletedAt: now, updatedAt: now },
    });
  }
}
