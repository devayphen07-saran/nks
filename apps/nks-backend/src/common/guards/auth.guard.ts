import * as crypto from 'crypto';
import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { SessionUser } from '../../contexts/iam/auth/interfaces/session-user.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROTATE_CSRF_KEY } from '../decorators/rotate-csrf.decorator';
import { TokenExtractorService, type AuthType } from './services/token-extractor.service';
import { SessionValidatorService } from './services/session-validator.service';
import { SessionLifecycleService } from './services/session-lifecycle.service';
import { UserContextLoaderService } from '../../contexts/iam/auth/services/guard/user-context-loader.service';
import { AuthPolicyService } from '../../contexts/iam/auth/services/guard/auth-policy.service';
import type { SessionUpdateContext } from './session-context';

export interface AuthenticatedRequest extends Request {
  user: SessionUser;
  session: { id: string; expiresAt: Date };
  authType: AuthType;
  sessionContext?: SessionUpdateContext;
}

/**
 * Auth transport — drives CSRF enforcement and session rotation.
 *
 *   cookie  → web browser (nks_session cookie)
 *             CSRF ON  — browsers auto-send cookies cross-origin; CSRF defends against that.
 *             Rolling rotation ON  — 1-hour window limits stolen-cookie replay.
 *
 *   bearer  → mobile / API client (Authorization: Bearer <token>)
 *             CSRF OFF — Bearer tokens are not sent automatically; no CSRF risk.
 *             Rolling rotation OFF — client drives rotation via POST /auth/refresh-token.
 *
 * Responsibilities are split across four collaborators:
 *   TokenExtractorService   — extract token + transport from request
 *   SessionValidatorService — DB lookup, expiry, JTI, CSRF
 *   UserContextLoaderService — user + roles → SessionUser
 *   SessionLifecycleService — rolling rotation, CSRF rotation, cookie sync
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tokenExtractor: TokenExtractorService,
    private readonly sessionValidator: SessionValidatorService,
    private readonly userLoader: UserContextLoaderService,
    private readonly policy: AuthPolicyService,
    private readonly sessionLifecycle: SessionLifecycleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (this.isPublic(context)) return true;

    const start = Date.now();
    const { token, authType } = this.tokenExtractor.extract(req);
    const { session, user, roles } = await this.sessionValidator.validate(token, req, authType);

    const shouldRotate = this.sessionLifecycle.isRotationDue(session);
    const { sessionUser, isActive } = await this.userLoader.load(
      user,
      roles,
      session.activeStoreFk ?? null,
      session.id,
    );

    await this.policy.enforceAccountStatus(sessionUser, isActive, session);
    this.policy.detectIpChange(session.ipHash, req.ip ?? '');

    const authed = req as AuthenticatedRequest;
    authed.user = sessionUser;
    authed.session = { id: String(session.id), expiresAt: session.expiresAt };
    authed.authType = authType;

    // ── Signal interceptor for cookie side effects ───────────────────────────
    // SessionRotationInterceptor reads req.sessionContext after the handler
    // completes and applies DB rotation + Set-Cookie headers there.
    // Guard stays a pure validation layer; no cookie writes happen here.
    if (authType === 'cookie') {
      const isRotateCsrf = !shouldRotate && this.isRotateCsrf(context);
      authed.sessionContext = {
        authType: 'cookie',
        sessionToken: token,
        sessionId: session.id,
        csrfSecretOrToken: session.csrfSecret ?? token,
        shouldRotateSession: shouldRotate,
        csrfSecretOverride: isRotateCsrf
          ? crypto.randomBytes(32).toString('hex')
          : undefined,
      };
    }

    this.logger.debug({
      msg: 'Auth success',
      userId: sessionUser.userId,
      authType,
      path: req.path,
      durationMs: Date.now() - start,
    });

    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? false;
  }

  private isRotateCsrf(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(ROTATE_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? false;
  }
}
