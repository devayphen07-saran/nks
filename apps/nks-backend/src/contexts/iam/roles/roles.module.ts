import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesRepository } from './repositories/roles.repository';
import { PermissionsRepository } from './repositories/role-permissions.repository';
import { RolesController } from './roles.controller';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { PermissionEvaluatorService } from './permission-evaluator.service';
import { RoleQueryService } from './role-query.service';
import { RoleMutationService } from './role-mutation.service';
import { TransactionService } from '../../../core/database/transaction.service';
import { StoresModule } from '../../organization/stores/stores.module';

// GuardsModule is intentionally NOT imported: nothing exported from it is
// used here (RBACGuard is a provider of this module, not GuardsModule).
// Removing the import also lets GuardsModule depend on RolesModule later
// without creating a cycle.
@Module({
  imports: [StoresModule],
  controllers: [RolesController],
  providers: [
    RolesService,
    RolesRepository,
    PermissionsRepository,
    RBACGuard,
    PermissionEvaluatorService,
    RoleQueryService,
    RoleMutationService,
    TransactionService,
  ],
  exports: [
    StoresModule,
    RolesService,
    RolesRepository,
    PermissionsRepository,
    RBACGuard,
    PermissionEvaluatorService,
    RoleQueryService,
    RoleMutationService,
  ],
})
export class RolesModule {}
