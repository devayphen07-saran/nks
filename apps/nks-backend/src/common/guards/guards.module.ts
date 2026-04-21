import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { SessionsRepository } from '../../contexts/iam/auth/repositories/sessions.repository';

/**
 * GuardsModule — provides AuthGuard and its non-global dependencies.
 *
 * AuthGuard requires SessionsRepository (the only dependency not covered
 * by the already-global DatabaseModule and ConfigModule).
 *
 * Import this module in any feature module whose controllers use
 * @UseGuards(AuthGuard) or the @RequirePermission() composite decorator.
 *
 * RBACGuard dependencies (PermissionEvaluatorService, StoresRepository)
 * are provided by RolesModule — import RolesModule alongside this one
 * when using @UseGuards(AuthGuard, RBACGuard).
 */
@Module({
  providers: [AuthGuard, SessionsRepository],
  exports: [AuthGuard, SessionsRepository],
})
export class GuardsModule {}
