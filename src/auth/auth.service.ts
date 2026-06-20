import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

interface RefreshPayload {
  sub: string;
  jti: string;
}

export interface AuthResult {
  user: { id: string; email: string; name: string | null };
  accessToken: string;
  refreshToken: string;
}

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.accessExpiresIn = config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.refreshExpiresIn = config.get<string>('JWT_REFRESH_EXPIRES_IN', '90d');
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, SALT_ROUNDS),
        name: dto.name ?? null,
        openingSavings: BigInt(dto.openingSavings ?? 0),
      },
    });

    return this.buildAuthResult(user.id, user.email, user.name);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildAuthResult(user.id, user.email, user.name);
  }

  async refresh(rawToken: string): Promise<AuthResult> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(rawToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const record = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });
    if (
      !record ||
      record.revoked ||
      record.userId !== payload.sub ||
      record.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.tokenHash !== this.hashToken(rawToken)) {
      // Token reuse / tampering: revoke every session for this user.
      await this.prisma.refreshToken.updateMany({
        where: { userId: payload.sub },
        data: { revoked: true },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotate: revoke the used token before issuing a new pair.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revoked: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.buildAuthResult(user.id, user.email, user.name);
  }

  async logout(rawToken: string): Promise<{ success: boolean }> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(rawToken, {
        secret: this.refreshSecret,
      });
      await this.prisma.refreshToken.updateMany({
        where: { id: payload.jti },
        data: { revoked: true },
      });
    } catch {
      // Already invalid/expired — treat logout as idempotent.
    }
    return { success: true };
  }

  private async buildAuthResult(
    userId: string,
    email: string,
    name: string | null,
  ): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      { secret: this.accessSecret, expiresIn: this.accessExpiresIn },
    );

    const tokenId = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, jti: tokenId },
      { secret: this.refreshSecret, expiresIn: this.refreshExpiresIn },
    );

    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return { user: { id: userId, email, name }, accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
