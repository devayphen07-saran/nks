import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditRepository } from './repositories/audit.repository';

/**
 * Audit Module
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
  providers: [AuditService, AuditRepository],
  exports: [AuditService, AuditRepository],
})
export class AuditModule {}
