import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditRepository } from './repositories/audit.repository';
import { RolesModule } from '../../iam/roles/roles.module';
import { GuardsModule } from '../../../common/guards/guards.module';

/**
 * Audit Module — kept @Global because RolesModule depends on AuditService
 * and AuditModule depends on RolesModule (for RBACGuard), creating a
 * bidirectional relationship that forwardRef would handle but @Global
 * avoids more cleanly.
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
  providers: [AuditService, AuditRepository],
  exports: [AuditService, AuditRepository],
})
export class AuditModule {}
