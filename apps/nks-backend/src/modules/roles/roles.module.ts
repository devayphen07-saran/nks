import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesRepository } from './repositories/roles.repository';
import { RoleEntityPermissionRepository } from './repositories/role-entity-permission.repository';
import { RolesController } from './roles.controller';
import { RBACGuard } from '../../common/guards/rbac.guard';
import { PermissionChecker } from '../../common/utils/permission-checker';

@Module({
  controllers: [RolesController],
  providers: [
    RolesService,
    RolesRepository,
    RoleEntityPermissionRepository,
    RBACGuard,
    PermissionChecker,
  ],
  exports: [
    RolesService,
    RolesRepository,
    RoleEntityPermissionRepository,
    RBACGuard,
    PermissionChecker,
  ],
})
export class RolesModule {}
