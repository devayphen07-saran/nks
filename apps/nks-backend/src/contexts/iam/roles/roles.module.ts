import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesRepository } from './repositories/roles.repository';
import { PermissionsRepository } from './repositories/role-permissions.repository';
import { RolePermissionService } from './role-permission.service';
import { RolesController } from './roles.controller';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { PermissionEvaluatorService } from './permission-evaluator.service';
import { RoleQueryService } from './role-query.service';
import { RoleCommandService } from './role-command.service';
import { StoreConfigService } from './store-config.service';
import { StoreConfigController } from './store-config.controller';
import { TransactionService } from '../../../core/database/transaction.service';
import { StoresModule } from '../../organization/stores/stores.module';
import { EntitiesModule } from '../../reference-data/entities';
import { PermissionsChangelogModule } from '../../../shared/permissions-changelog/permissions-changelog.module';

// GuardsModule is intentionally NOT imported: nothing exported from it is
// used here (RBACGuard is a provider of this module, not GuardsModule).
// Removing the import also lets GuardsModule depend on RolesModule later
// without creating a cycle.
//
// AuditModule is NOT imported here: it remains @Global() to avoid a
// structural cycle (AuditController → RBACGuard → RolesModule). Tracked as
// known debt — see audit.module.ts header.
@Module({
  imports:     [StoresModule, EntitiesModule, PermissionsChangelogModule],
  controllers: [RolesController, StoreConfigController],
  providers: [
    RolesService,
    RolesRepository,
    PermissionsRepository,
    RBACGuard,
    PermissionEvaluatorService,
    RolePermissionService,
    RoleQueryService,
    RoleCommandService,
    StoreConfigService,
    TransactionService,
  ],
  exports: [
    StoresModule,
    RolesService,
    RolesRepository,
    PermissionsRepository,
    RBACGuard,
    PermissionEvaluatorService,
    RolePermissionService,
    RoleQueryService,
    RoleCommandService,
  ],
})
export class RolesModule {}
