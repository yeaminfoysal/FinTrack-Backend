import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
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
  private readonly resetUrlBase: string;
  private readonly resetExpiresMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.accessExpiresIn = config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.refreshExpiresIn = config.get<string>('JWT_REFRESH_EXPIRES_IN', '90d');
    this.resetUrlBase = config.get<string>(
      'PASSWORD_RESET_URL',
      'fintrack://reset-password',
    );
    this.resetExpiresMs =
      Number(config.get<string>('PASSWORD_RESET_EXPIRES_MIN', '60')) * 60 * 1000;
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

  /**
   * Issues a single-use, time-limited reset token and emails a reset link.
   * Always returns success so the endpoint never reveals whether an email exists.
   */
  async forgotPassword(email: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      // Invalidate any previously issued, still-unused tokens.
      await this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const rawToken = randomBytes(32).toString('hex');
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(rawToken),
          expiresAt: new Date(Date.now() + this.resetExpiresMs),
        },
      });

      const separator = this.resetUrlBase.includes('?') ? '&' : '?';
      const resetUrl = `${this.resetUrlBase}${separator}token=${rawToken}`;
      await this.mail.sendPasswordReset(user.email, resetUrl);
    }
    return { success: true };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Security: force re-login on every device after a password reset.
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId },
        data: { revoked: true },
      }),
    ]);
    return { success: true };
  }

  private async buildAuthResult(
    userId: string,
    email: string,
    name: string | null,
  ): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.accessSecret,
        expiresIn: this.accessExpiresIn as unknown as number,
      },
    );

    const tokenId = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, jti: tokenId },
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresIn as unknown as number,
      },
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
