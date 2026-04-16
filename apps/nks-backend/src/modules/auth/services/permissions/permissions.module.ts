import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../../auth-core.module';
import { RolesModule } from '../../../roles/roles.module';
import { PermissionsService } from './permissions.service';

/**
 * AuthPermissionsModule — resolves user role/entity permissions.
 * Depends on: repositories (via AuthCoreModule) + RolesModule for role lookups.
 */
@Module({
  imports: [AuthCoreModule, RolesModule],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class AuthPermissionsModule {}
