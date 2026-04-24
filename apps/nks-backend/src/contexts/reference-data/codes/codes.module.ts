import { Module } from '@nestjs/common';
import { GuardsModule } from '../../../common/guards/guards.module';
import { RolesModule } from '../../iam/roles/roles.module';
import { CodesController } from './codes.controller';
import { AdminCodesController } from './admin-codes.controller';
import { CodesService } from './codes.service';
import { CodesRepository } from './repositories/codes.repository';

// RolesModule supplies PermissionEvaluatorService + StoresService required
// by RBACGuard (used by both controllers — STORE scope for writes on the
// public CodesController, PLATFORM scope on AdminCodesController).
@Module({
  imports:     [GuardsModule, RolesModule],
  controllers: [CodesController, AdminCodesController],
  providers:   [CodesService, CodesRepository],
  exports:     [CodesService, CodesRepository],
})
export class CodesModule {}
