import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesRepository } from './repositories/roles.repository';
import { RoleEntityPermissionRepository } from './repositories/role-entity-permission.repository';
import { RolesController } from './roles.controller';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { PermissionEvaluatorService } from './permission-evaluator.service';
import { StoresModule } from '../../organization/stores/stores.module';
import { GuardsModule } from '../../../common/guards/guards.module';

@Module({
  imports: [GuardsModule, StoresModule],
  controllers: [RolesController],
  providers: [
    RolesService,
    RolesRepository,
    RoleEntityPermissionRepository,
    RBACGuard,
    PermissionEvaluatorService,
  ],
  exports: [
    RolesService,
    RolesRepository,
    RoleEntityPermissionRepository,
    RBACGuard,
    PermissionEvaluatorService,
  ],
})
export class RolesModule {}
