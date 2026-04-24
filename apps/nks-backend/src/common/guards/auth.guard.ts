import * as crypto from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '../exceptions';
import { ErrorCode } from '../constants/error-codes.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { Request } from 'express';
import { SessionMapper } from '../../contexts/iam/auth/mapper/session.mapper';
import type { SessionUser } from '../../contexts/iam/auth/interfaces/session-user.interface';
import { fireAndForgetWithRetry } from '../utils/retry';
import { extractCookieValue } from '../utils/cookie.utils';
import { LAST_ACTIVE_THROTTLE_MS } from '../../contexts/iam/auth/auth.constants';
import { AuthContextService } from '../../contexts/iam/auth/services/session/auth-context.service';
import { RoleQueryService } from '../../contexts/iam/roles/role-query.service';

/** Extend Express Request with strongly-typed user fields. */
export interface AuthenticatedRequest extends Request {
  user: SessionUser;
  session: { id: string; expiresAt: Date };
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
    private readonly authContext: AuthContextService,
    private readonly roleQuery: RoleQueryService,
    private readonly configService: ConfigService,
  ) {
    this.ipHmacSecret = this.configService.getOrThrow<string>('IP_HMAC_SECRET');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      this.logger.debug(`Public route: ${request.method} ${request.path}`);
      return true;
    }


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
    // DUAL-STATE NOTE: Session validity and JTI validity are independent checks.
    // A session row can be live (not deleted, not expired) while its JTI is
    // blocklisted — this happens when only the access JWT is revoked (e.g., after
    // an explicit logout that blocklists the JTI but retains the session for
    // audit purposes). Both conditions must pass: dbSession must be non-null AND
    // revokedJti must be null.
    //
    // SECURITY NOTE: Session tokens are stored as raw opaque bytes (BetterAuth default).
    // A read-only DB breach would expose all active sessions. Hardening path: store
    // sha256(token) and look up by hash — requires forking BetterAuth session creation.
    const { session: dbSession, revokedJti } =
      await this.authContext.findSessionByToken(sessionToken);

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
    if (revokedJti) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_TOKEN_INVALID,
        message: 'Token has been revoked.',
      });
    }

    // 4. Fetch user and roles in parallel — both depend only on dbSession.userId
    const [dbUser, roleRows] = await Promise.all([
      this.authContext.findUserById(dbSession.userId),
      this.roleQuery.findUserRolesForAuth(dbSession.userId),
    ]);

    if (!dbUser) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_SESSION_EXPIRED,
        message: 'User not found for session.',
      });
    }

    // 5. Map DB rows to SessionUser — derives roles, isSuperAdmin, isBlocked, etc.
    // SECURITY: do this before attaching to request so a blocked user's data is
    // never visible to exception filters or logging interceptors on the error path.
    const sessionUser = SessionMapper.buildSessionUser(
      dbUser,
      roleRows,
      dbSession.activeStoreFk ?? null,
    );

    if (sessionUser.isBlocked) {
      // CRITICAL: delete sessions synchronously before throwing — fire-and-forget
      // would let a race window keep the session alive if the process crashes.
      try {
        await this.authContext.deleteAllSessionsForUser(sessionUser.userId);
        this.logger.warn(`Deleted all sessions for blocked user ${sessionUser.userId}`);
      } catch (err) {
        this.logger.error(
          `Failed to delete sessions for blocked user ${sessionUser.userId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      throw new UnauthorizedException({
        errorCode: ErrorCode.USER_BLOCKED,
        message: 'Account is blocked',
      });
    }

    // ── Stale activeStoreId defence ──────────────────────────────────────────
    // The session persists activeStoreId in the DB. If the user's role in that
    // store was revoked after the session was created, the stored FK is stale.
    // Null it out in memory so STORE-scope guards see no store context, and
    // persist the fix asynchronously so the next request is already clean.
    // SUPER_ADMIN is exempt — they have access to all stores regardless of
    // role assignments.
    if (sessionUser.activeStoreId !== null && !sessionUser.isSuperAdmin) {
      const hasRoleInActiveStore = sessionUser.roles.some(
        (r) => r.storeId === sessionUser.activeStoreId,
      );
      if (!hasRoleInActiveStore) {
        this.logger.warn(
          `Cleared stale activeStoreId ${sessionUser.activeStoreId} for user ${sessionUser.userId} — no current role assignment.`,
        );
        sessionUser.activeStoreId = null;
        fireAndForgetWithRetry(
          () => this.authContext.clearActiveStore(dbSession.id),
          {
            maxRetries: 2,
            initialDelayMs: 500,
            logger: this.logger,
            logLabel: `ClearStaleActiveStore user=${sessionUser.userId}`,
          },
        );
      }
    }

    (request as AuthenticatedRequest).user = sessionUser;
    (request as AuthenticatedRequest).session = {
      id: String(dbSession.id),
      expiresAt: dbSession.expiresAt,
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
    const lastActive = dbUser.lastActiveAt ? new Date(dbUser.lastActiveAt).getTime() : 0;
    if (Date.now() - lastActive > LAST_ACTIVE_THROTTLE_MS) {
      fireAndForgetWithRetry(
        () => this.authContext.touchUserLastActive(sessionUser.userId),
        {
          maxRetries: 3,
          initialDelayMs: 500,
          logger: this.logger,
          logLabel: `Update lastActiveAt for user ${sessionUser.userId}`,
        },
      );
    }

    return true;
  }

  /**
   * Resilience fallback: parse nks_session directly from the raw Cookie header.
   *
   * cookie-parser (registered in main.ts) normally populates request.cookies,
   * so the primary path `(request.cookies as ParsedCookies)?.nks_session` is
   * taken in production. This fallback activates if cookie-parser is skipped or
   * middleware order is changed, preventing a silent auth regression where every
   * web request would be rejected as unauthenticated with no indication why.
   */
  private extractNksSessionCookie(request: Request): string | undefined {
    return extractCookieValue(request.headers.cookie ?? '', 'nks_session');
  }
}
