import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from '../types/auth-user.type';

/** Injects the authenticated user (set by JwtStrategy) into a controller handler. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | string => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    return data ? request.user[data] : request.user;
  },
);
