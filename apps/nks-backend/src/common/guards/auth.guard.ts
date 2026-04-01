import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';
import { UnauthorizedException } from '../exceptions';
import { ErrorCode } from '../constants/error-codes.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { Request } from 'express';
import { SessionUser } from 'src/modules/auth/interfaces/session-user.interface';
import { fireAndForgetWithRetry } from '../utils/retry';

/** Extend Express Request with strongly-typed user fields. */
export interface AuthenticatedRequest extends Request {
  user: SessionUser;
  session: { id: string; token: string; expiresAt: Date };
  /** Cached per-request permission codes (populated by PermissionGuard). */
  userPermissions?: Set<string>;
  /** Cached per-request SUPER_ADMIN flag (populated by PermissionGuard). */
  isSuperAdmin?: boolean;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectDb() private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // ✅ SECURITY: Support both Authorization header and httpOnly cookies
    // Web: Uses httpOnly cookies (nks_session) — must extract and convert to Bearer
    // Mobile: Uses Authorization: Bearer <token> header directly
    // BetterAuth validates the Bearer token via getSession()

    // 1. Extract session token from:
    //    - Authorization header (mobile): Bearer <token>
    //    - nks_session cookie (web): parsed by cookie-parser middleware
    const authHeader = request.headers.authorization || '';
    const bearerToken = authHeader.replace('Bearer ', '').trim();

    // ✅ Try parsed cookies first (cookie-parser middleware)
    const nksSessionCookie =
      (request.cookies as any)?.nks_session ||
      this.extractNksSessionCookie(request);

    const sessionToken = bearerToken || nksSessionCookie;

    if (!sessionToken) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_TOKEN_INVALID,
        message: 'No token in Authorization header or httpOnly cookie.',
      });
    }

    // 2. Validate session directly from database (BetterAuth's getSession() has issues)
    const [dbSession] = await this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.token, sessionToken))
      .limit(1);

    if (!dbSession) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_TOKEN_INVALID,
        message: 'Invalid or expired session token.',
      });
    }

    // 3. Check if session has expired
    if (dbSession.expiresAt < new Date()) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_SESSION_EXPIRED,
        message: 'Session has expired.',
      });
    }

    // 4. Fetch user data
    const [dbUser] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, dbSession.userId))
      .limit(1);

    if (!dbUser) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_SESSION_EXPIRED,
        message: 'User not found for session.',
      });
    }

    // Build sessionData for compatibility with rest of code
    const sessionData = {
      id: String(dbSession.id),
      token: dbSession.token,
      expiresAt: dbSession.expiresAt,
    };
    const user = dbUser;

    // 2. Validate user ID exists and is valid
    if (!user?.id) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_SESSION_EXPIRED,
        message: 'User ID is missing from session',
      });
    }

    // 3. Validate session data
    if (!sessionData?.id || !sessionData?.expiresAt) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_SESSION_EXPIRED,
        message: 'Invalid session data',
      });
    }

    // 4. Map BetterAuth user to our SessionUser shape.
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
      name: u.name ?? '',
      email: u.email ?? '',
      emailVerified: u.emailVerified ?? false,
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

    // 5. Check if account is blocked — invalidate session immediately
    if (u.isBlocked) {
      // ✅ FIX: Delete sessions with error logging and retry logic
      fireAndForgetWithRetry(
        async () => {
          await this.db
            .delete(schema.userSession)
            .where(eq(schema.userSession.userId, Number(u.id)));
        },
        {
          maxRetries: 3,
          initialDelayMs: 500,
          logger: this.logger,
          logLabel: `Delete sessions for blocked user ${u.id}`,
        },
      );

      throw new UnauthorizedException({
        errorCode: ErrorCode.USER_BLOCKED,
        message: `Account is blocked${u.blockedReason ? ': ' + u.blockedReason : ''}`,
      });
    }

    (request as AuthenticatedRequest).session = {
      id: sessionData.id,
      token: sessionData.token,
      expiresAt: sessionData.expiresAt,
    };

    // 6. Update lastActiveAt on every authenticated request (non-critical, fire-and-forget)
    fireAndForgetWithRetry(
      async () => {
        await this.db
          .update(schema.users)
          .set({ lastActiveAt: new Date() })
          .where(eq(schema.users.id, Number(user.id)));
      },
      {
        maxRetries: 3,
        initialDelayMs: 500,
        logger: this.logger,
        logLabel: `Update lastActiveAt for user ${user.id}`,
      },
    );

    return true;
  }

  /**
   * Fallback cookie extraction from raw Cookie header
   * (cookie-parser middleware should handle this, but this is a fallback)
   */
  private extractNksSessionCookie(request: Request): string | undefined {
    const cookieHeader = request.headers.cookie ?? '';
    return cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('nks_session='))
      ?.split('=')[1];
  }
}
