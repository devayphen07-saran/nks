import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';
import { userRoleMapping } from '../../core/database/schema/auth/user-role-mapping';
import { UnauthorizedException } from '../exceptions';
import { ErrorCode } from '../constants/error-codes.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { Request } from 'express';
import { SessionUser, SessionUserRole } from 'src/modules/auth/interfaces/session-user.interface';
import { fireAndForgetWithRetry } from '../utils/retry';
import { extractCookieValue } from '../utils/cookie.utils';
import { LAST_ACTIVE_THROTTLE_MS } from '../../modules/auth/auth.constants';
import { SessionsRepository } from '../../modules/auth/repositories/sessions.repository';
import { JtiBlocklistService } from '../../modules/auth/services/token/jti-blocklist.service';

/** Extend Express Request with strongly-typed user fields. */
export interface AuthenticatedRequest extends Request {
  user: SessionUser;
  session: { id: string; token: string; expiresAt: Date };
  /** Cached per-request permission codes (populated by PermissionGuard). */
  userPermissions?: Set<string>;
  /** Cached per-request SUPER_ADMIN flag (populated by PermissionGuard). */
  isSuperAdmin?: boolean;
}

/** Type-safe Express Request cookies (from cookie-parser middleware) */
interface ParsedCookies {
  nks_session?: string;
  [key: string]: string | undefined;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectDb() private readonly db: NodePgDatabase<typeof schema>,
    private readonly sessionsRepository: SessionsRepository,
    private readonly jtiBlocklist: JtiBlocklistService,
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
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();

    // ✅ Try parsed cookies first (cookie-parser middleware)
    const nksSessionCookie =
      (request.cookies as ParsedCookies)?.nks_session ||
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

    // 3b. Check JTI blocklist — rejects tokens that were revoked mid-flight
    // (e.g., session terminated while a 15-min JWT was still in flight).
    if (dbSession.jti && await this.jtiBlocklist.isBlocked(dbSession.jti)) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_TOKEN_INVALID,
        message: 'Token has been revoked.',
      });
    }

    // 4. Fetch user and roles in parallel — both depend only on dbSession.userId
    const [userRows, roleRows] = await Promise.all([
      this.db
        .select()
        .from(schema.users)
        .where(and(eq(schema.users.id, dbSession.userId), isNull(schema.users.deletedAt)))
        .limit(1),
      this.db
        .select({
          roleCode: schema.roles.code,
          storeFk: userRoleMapping.storeFk,
          storeName: schema.store.storeName,
          isPrimary: userRoleMapping.isPrimary,
          assignedAt: userRoleMapping.assignedAt,
          expiresAt: userRoleMapping.expiresAt,
        })
        .from(userRoleMapping)
        .innerJoin(schema.roles, eq(userRoleMapping.roleFk, schema.roles.id))
        .leftJoin(schema.store, eq(userRoleMapping.storeFk, schema.store.id))
        .where(
          and(
            eq(userRoleMapping.userFk, dbSession.userId),
            eq(userRoleMapping.isActive, true),
            isNull(userRoleMapping.deletedAt),
            // Exclude roles whose temporary grant has expired
            or(isNull(userRoleMapping.expiresAt), gt(userRoleMapping.expiresAt, new Date())),
          ),
        ),
    ]);

    const [dbUser] = userRows;

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

    const roles: SessionUserRole[] = roleRows.map((r) => ({
      roleCode: r.roleCode,
      storeId: r.storeFk ?? null,
      storeName: r.storeName ?? null,
      isPrimary: r.isPrimary,
      assignedAt: r.assignedAt.toISOString(),
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    }));
    const primaryRole = roleRows.find((r) => r.isPrimary)?.roleCode ?? roleRows[0]?.roleCode ?? null;
    const isSuperAdmin = roles.some((r) => r.roleCode === 'SUPER_ADMIN');

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
      lastLoginAt: u.lastLoginAt ?? null,
      roles,
      primaryRole,
      isSuperAdmin,
      activeStoreId: dbSession.activeStoreFk ?? null,
    };

    // 5. Check if account is blocked — invalidate session immediately
    if (u.isBlocked) {
      // CRITICAL: Delete sessions BEFORE throwing error (synchronous, not fire-and-forget)
      try {
        await this.sessionsRepository.deleteAllForUser(Number(u.id));
        this.logger.warn(`Deleted all sessions for blocked user ${u.id}`);
      } catch (err) {
        this.logger.error(
          `Failed to delete sessions for blocked user ${u.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
        // Continue to throw auth error even if session deletion fails
      }

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

    // 6. Update lastActiveAt — throttled to once every 5 minutes to avoid
    //    a DB write on every single authenticated request.
    const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
    if (Date.now() - lastActive > LAST_ACTIVE_THROTTLE_MS) {
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
    }

    return true;
  }

  /**
   * Fallback cookie extraction from raw Cookie header
   * (cookie-parser middleware should handle this, but this is a fallback)
   */
  private extractNksSessionCookie(request: Request): string | undefined {
    return extractCookieValue(request.headers.cookie ?? '', 'nks_session');
  }
}
