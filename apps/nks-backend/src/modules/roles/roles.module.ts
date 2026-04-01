import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { RolesRepository } from './roles.repository';
import { RoleEntityPermissionRepository } from './role-entity-permission.repository';

@Module({
  controllers: [RolesController],
  providers: [RolesService, RolesRepository, RoleEntityPermissionRepository],
  exports: [RolesService, RolesRepository, RoleEntityPermissionRepository],
})
export class RolesModule {}
