import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { OwnershipGuard } from './ownership.guard';
import { AuthModule } from '../../contexts/iam/auth/auth.module';
import { CsrfTokenService } from '../middleware/csrf-token.service';
import { TokenExtractorService } from './services/token-extractor.service';
import { SessionValidatorService } from './services/session-validator.service';
import { SessionLifecycleService } from './services/session-lifecycle.service';
import { CsrfValidationService } from './services/csrf-validation.service';

/**
 * GuardsModule — cross-cutting guards (AuthGuard, OwnershipGuard).
 *
 * AuthGuard responsibility split:
 *   TokenExtractorService    — extract token + auth transport (cookie / bearer)
 *   SessionValidatorService  — DB lookup, expiry, JTI, CSRF header check
 *   UserContextLoaderService — user + roles → SessionUser  (from AuthModule)
 *   AuthPolicyService        — account status + IP change   (from AuthModule)
 *   SessionLifecycleService  — isRotationDue() check only; guard stamps
 *                              _pendingSessionUpdates for SessionRotationInterceptor
 *   CsrfValidationService    — CSRF validate + syncCookie (shared with interceptor)
 *
 * Cookie side-effects (DB rotation, Set-Cookie) run in SessionRotationInterceptor
 * after the handler — the guard itself is a pure validation layer.
 *
 * RateLimitingGuard lives in rate-limiting.module.ts.
 */
@Module({
  imports: [AuthModule],
  providers: [
    AuthGuard,
    OwnershipGuard,
    CsrfTokenService,
    CsrfValidationService,
    TokenExtractorService,
    SessionValidatorService,
    SessionLifecycleService,
  ],
  exports: [AuthGuard, OwnershipGuard, CsrfValidationService],
})
export class GuardsModule {}
