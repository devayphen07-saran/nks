import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditRepository } from './repositories/audit.repository';
import { AuditEventListener } from './audit-event.listener';
import { GuardsModule } from '../../../common/guards/guards.module';
import { RolesModule } from '../../iam/roles/roles.module';

/**
 * Audit Module — @Global so feature modules (RolesModule, AuthModule, etc.)
 * can inject AuditService without each importing AuditModule.
 *
 * AuditController uses RBACGuard with @RequireEntityPermission(AUDIT_LOG)
 * (scope: PLATFORM), so RolesModule is imported here to supply
 * PermissionEvaluatorService + StoresService. No circular dependency:
 * RolesModule consumes AuditService via the @Global() decorator, not via
 * an explicit import of AuditModule.
 *
 * Provides centralized audit logging for all security-relevant events:
 * - Authentication (login, logout, OTP)
 * - Permissions (grant, revoke)
 * - Tokens (refresh, theft detection)
 * - Super Admin actions (break-glass access)
 * - Device/session events
 */
@Global()
@Module({
  imports: [GuardsModule, RolesModule],
  controllers: [AuditController],
  providers: [AuditService, AuditRepository, AuditEventListener],
  exports: [AuditService, AuditRepository],
})
export class AuditModule {}
