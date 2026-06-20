import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { QueryIncomeDto } from './dto/query-income.dto';

@Injectable()
export class IncomeService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateIncomeDto) {
    const now = new Date();
    return this.prisma.income.create({
      data: {
        id: dto.id ?? randomUUID(),
        userId,
        amount: BigInt(dto.amount),
        source: dto.source,
        date: new Date(dto.date),
        note: dto.note ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  findAll(userId: string, query: QueryIncomeDto) {
    const where: Prisma.IncomeWhereInput = { userId, isDeleted: false };
    if (query.from || query.to) {
      where.date = {};
      if (query.from) where.date.gte = new Date(query.from);
      if (query.to) where.date.lte = new Date(query.to);
    }
    return this.prisma.income.findMany({ where, orderBy: { date: 'desc' } });
  }

  async findOne(userId: string, id: string) {
    const income = await this.prisma.income.findFirst({
      where: { id, userId, isDeleted: false },
    });
    if (!income) {
      throw new NotFoundException('Income not found');
    }
    return income;
  }

  async update(userId: string, id: string, dto: UpdateIncomeDto) {
    await this.findOne(userId, id);
    return this.prisma.income.update({
      where: { id },
      data: {
        amount: dto.amount === undefined ? undefined : BigInt(dto.amount),
        source: dto.source,
        date: dto.date === undefined ? undefined : new Date(dto.date),
        note: dto.note,
        updatedAt: new Date(),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    // Soft delete (Modification #3): tombstone so the deletion syncs to other devices.
    const now = new Date();
    return this.prisma.income.update({
      where: { id },
      data: { isDeleted: true, deletedAt: now, updatedAt: now },
    });
  }
}
