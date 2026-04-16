import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesRepository } from './repositories/roles.repository';
import { RoleEntityPermissionRepository } from './repositories/role-entity-permission.repository';
import { RolesController } from './roles.controller';
import { RBACGuard } from '../../common/guards/rbac.guard';

@Module({
  controllers: [RolesController],
  providers: [
    RolesService,
    RolesRepository,
    RoleEntityPermissionRepository,
    RBACGuard,
  ],
  exports: [
    RolesService,
    RolesRepository,
    RoleEntityPermissionRepository,
    RBACGuard,
  ],
})
export class RolesModule {}
