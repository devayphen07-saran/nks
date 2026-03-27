import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';
import { UnauthorizedException } from '../exceptions';
import { ErrorCode } from '../constants/error-codes.constants';
import type { Request } from 'express';
import { SessionUser } from 'src/modules/auth/interfaces/session-user.interface';
import { InjectAuth } from '../../modules/auth/decorators/inject-auth.decorator';
import type { Auth } from '../../modules/auth/config/better-auth';

/** Extend Express Request with strongly-typed user fields. */
export interface AuthenticatedRequest extends Request {
  user: SessionUser;
  session: Record<string, unknown>;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @InjectDb() private readonly db: NodePgDatabase<typeof schema>,
    @InjectAuth() private readonly auth: Auth,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // 1. Validate session via BetterAuth
    // BetterAuth handles token hashing, expiry, and the 'Bearer' prefix (via bearer plugin)
    const session = await this.auth.api.getSession({
      headers: request.headers as unknown as Headers,
    });

    if (!session) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_SESSION_EXPIRED,
        message: 'Invalid or expired session',
      });
    }

    const { user, session: sessionData } = session;

    // 2. Map BetterAuth user to our SessionUser shape.
    // BetterAuth extends the user type with custom plugin fields at runtime;
    // we widen the type once here rather than casting per-field.
    type BetterAuthUser = typeof user & {
      guuid?: string;
      phoneNumber?: string | null;
      phoneNumberVerified?: boolean;
      kycLevel?: number;
      languagePreference?: string;
      whatsappOptedIn?: boolean;
      isBlocked?: boolean;
      blockedReason?: string | null;
      loginCount?: number;
    };
    const u = user as BetterAuthUser;

    (request as AuthenticatedRequest).user = {
      id: String(u.id),
      userId: Number(u.id),
      guuid: u.guuid ?? '',
      name: u.name,
      email: u.email ?? '',
      emailVerified: u.emailVerified,
      image: u.image ?? null,
      phoneNumber: u.phoneNumber ?? null,
      phoneNumberVerified: u.phoneNumberVerified ?? false,
      kycLevel: u.kycLevel ?? 0,
      languagePreference: u.languagePreference ?? 'en',
      whatsappOptedIn: u.whatsappOptedIn ?? true,
      isBlocked: u.isBlocked ?? false,
      blockedReason: u.blockedReason ?? null,
      loginCount: u.loginCount ?? 0,
    };

    (request as AuthenticatedRequest).session = {
      id: sessionData.id,
      token: sessionData.token, // This is the hashed token in the DB
      expiresAt: sessionData.expiresAt,
    };

    return true;
  }
}
