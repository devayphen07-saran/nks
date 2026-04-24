import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { OwnershipGuard } from './ownership.guard';
import { AuthModule } from '../../contexts/iam/auth/auth.module';
import { RolesModule } from '../../contexts/iam/roles/roles.module';

/**
 * GuardsModule — cross-cutting guards (AuthGuard, OwnershipGuard).
 *
 * AuthGuard depends on narrow query services exported by their context
 * modules — never repositories directly:
 *   AuthGuard ← AuthContextService (AuthModule), RoleQueryService (RolesModule)
 *
 * RateLimitingGuard lives in `rate-limiting.module.ts`; feature modules
 * that only need rate limiting should import that instead of this module.
 */
@Module({
  imports: [AuthModule, RolesModule],
  providers: [AuthGuard, OwnershipGuard],
  exports: [AuthGuard, OwnershipGuard],
})
export class GuardsModule {}
