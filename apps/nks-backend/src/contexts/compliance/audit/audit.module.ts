import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditCommandService } from './audit-command.service';
import { AuditQueryService } from './audit-query.service';
import { AuditRepository } from './repositories/audit.repository';
import { AuditEventListener } from './audit-event.listener';
import { GuardsModule } from '../../../common/guards/guards.module';
import { RolesModule } from '../../iam/roles/roles.module';

/**
 * KNOWN ARCHITECTURE DEBT — AuditModule is @Global because un-globalising it
 * would require RolesModule (a major consumer of AuditCommandService) to import
 * it, while AuditController already imports RolesModule for RBACGuard. That
 * structural cycle can only be broken by either:
 *   - extracting RBACGuard + its deps (PermissionEvaluatorService,
 *     StoreQueryService) into a small RBACModule that both AuditModule and
 *     RolesModule can import, or
 *   - registering RBACGuard as a global APP_GUARD so AuditController no longer
 *     needs the RolesModule import.
 *
 * Either change is appropriate to bundle with B1 (auth-context contracts),
 * which already restructures DI in this area.
 */
@Global()
@Module({
  imports: [GuardsModule, RolesModule],
  controllers: [AuditController],
  providers: [AuditCommandService, AuditQueryService, AuditRepository, AuditEventListener],
  exports: [AuditCommandService, AuditQueryService, AuditRepository],
})
export class AuditModule {}
