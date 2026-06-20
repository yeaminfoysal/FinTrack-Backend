import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  openingSavings: true,
  currency: true,
  timezone: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.getProfile(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name },
      select: PROFILE_SELECT,
    });
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    await this.getProfile(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        currency: dto.currency,
        timezone: dto.timezone,
        openingSavings:
          dto.openingSavings === undefined
            ? undefined
            : BigInt(dto.openingSavings),
      },
      select: PROFILE_SELECT,
    });
  }
}
