import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditCommandService } from './audit-command.service';
import { AuditQueryService } from './audit-query.service';
import { AuditRepository } from './repositories/audit.repository';
import { AuditEventListener } from './audit-event.listener';
import { GuardsModule } from '../../../common/guards/guards.module';
import { RolesModule } from '../../iam/roles/roles.module';

@Global()
@Module({
  imports: [GuardsModule, RolesModule],
  controllers: [AuditController],
  providers: [AuditCommandService, AuditQueryService, AuditRepository, AuditEventListener],
  exports: [AuditCommandService, AuditQueryService, AuditRepository],
})
export class AuditModule {}
