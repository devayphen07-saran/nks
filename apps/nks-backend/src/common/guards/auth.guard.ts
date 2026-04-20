import * as crypto from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gt, isNotNull, isNull, or } from 'drizzle-orm';
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
import { SystemRoleCodes } from '../constants/system-role-codes.constant';
import { LAST_ACTIVE_THROTTLE_MS } from '../../modules/auth/auth.constants';
import { SessionsRepository } from '../../modules/auth/repositories/sessions.repository';

/** Extend Express Request with strongly-typed user fields. */
export interface AuthenticatedRequest extends Request {
  user: SessionUser;
  session: { id: string; token: string; expiresAt: Date };
}

/** Type-safe Express Request cookies (from cookie-parser middleware) */
interface ParsedCookies {
  nks_session?: string;
  [key: string]: string | undefined;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly ipHmacSecret: string;

  constructor(
    private readonly reflector: Reflector,
    @InjectDb() private readonly db: NodePgDatabase<typeof schema>,
    private readonly sessionsRepository: SessionsRepository,
    private readonly configService: ConfigService,
  ) {
    this.ipHmacSecret = this.configService.getOrThrow<string>('IP_HMAC_SECRET');
  }

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

    // 2. Validate session + JTI blocklist in a single atomic query.
    // A LEFT JOIN on jti_blocklist eliminates the TOCTOU race where a concurrent
    // logout could insert the JTI into the blocklist between a session fetch and
    // a subsequent separate blocklist query — both are now read in one snapshot.
    //
    // SECURITY NOTE: Session tokens are stored as raw opaque bytes (BetterAuth default).
    // A read-only DB breach would expose all active sessions. Hardening path: store
    // sha256(token) and look up by hash — requires forking BetterAuth session creation.
    const [row] = await this.db
      .select({
        session: schema.userSession,
        revokedJti: schema.jtiBlocklist.jti,
      })
      .from(schema.userSession)
      .leftJoin(
        schema.jtiBlocklist,
        and(
          isNotNull(schema.userSession.jti),
          eq(schema.jtiBlocklist.jti, schema.userSession.jti),
          gt(schema.jtiBlocklist.expiresAt, new Date()),
        ),
      )
      .where(eq(schema.userSession.token, sessionToken))
      .limit(1);

    const dbSession = row?.session;

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

    // 3b. JTI revocation — caught atomically in the JOIN above.
    if (row?.revokedJti) {
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
          roleId: userRoleMapping.roleFk,
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

    const sessionData = {
      id: String(dbSession.id),
      token: dbSession.token,
      expiresAt: dbSession.expiresAt,
    };
    const user = dbUser;

    // Map BetterAuth user to our SessionUser shape.
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
      roleId: r.roleId,
      roleCode: r.roleCode,
      storeId: r.storeFk ?? null,
      storeName: r.storeName ?? null,
      isPrimary: r.isPrimary,
      assignedAt: r.assignedAt.toISOString(),
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    }));
    const primaryRole = roleRows.find((r) => r.isPrimary)?.roleCode ?? roleRows[0]?.roleCode ?? null;
    const isSuperAdmin = roles.some((r) => r.roleCode === SystemRoleCodes.SUPER_ADMIN);

    // 5. Check if account is blocked BEFORE attaching user to request.
    // Attaching first would expose a blocked user's profile to exception filters
    // and logging interceptors on the error path.
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
        message: 'Account is blocked',
      });
    }

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

    (request as AuthenticatedRequest).session = {
      id: sessionData.id,
      token: sessionData.token,
      expiresAt: sessionData.expiresAt,
    };

    // 6. IP change detection — soft fraud signal, never rejects a request.
    // Mobile clients legitimately switch IPs (WiFi → LTE) and corporate NAT
    // may present a different IP per-request. A mismatch is a useful audit
    // signal but not proof of hijacking. Skipped for sessions created before
    // this feature was deployed (ipHash IS NULL).
    //
    // PREREQUISITE: Express must be configured with `app.set('trust proxy', ...)` for
    // request.ip to reflect the real client IP rather than the reverse proxy address.
    // Without this, every request appears to come from the same proxy IP and the
    // check is a no-op (which is safe — it just produces no signal).
    if (dbSession.ipHash) {
      const requestIp = request.ip ?? '';
      if (requestIp) {
        const currentIpHash = crypto
          .createHmac('sha256', this.ipHmacSecret)
          .update(requestIp)
          .digest('hex');
        if (currentIpHash !== dbSession.ipHash) {
          this.logger.warn(
            `IP change detected: session=${dbSession.id} user=${dbSession.userId} — network switch or proxy change.`,
          );
        }
      }
    }

    // 7. Update lastActiveAt — throttled to once every 5 minutes to avoid
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
   * Fallback cookie extraction from raw Cookie header.
   * cookie-parser middleware (registered globally in main.ts) should always
   * populate request.cookies, making this path dead code in normal operation.
   * Retained as a safety net in case middleware order changes or cookie-parser
   * is removed — prevents a silent auth regression.
   */
  private extractNksSessionCookie(request: Request): string | undefined {
    return extractCookieValue(request.headers.cookie ?? '', 'nks_session');
  }
}
