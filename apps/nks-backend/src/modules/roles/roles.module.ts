import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesRepository } from './repositories/roles.repository';
import { RoleEntityPermissionRepository } from './repositories/role-entity-permission.repository';
import { RolesController } from './roles.controller';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { PermissionEvaluatorService } from './permission-evaluator.service';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [StoresModule],
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
