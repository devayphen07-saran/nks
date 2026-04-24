import { Global, Module } from '@nestjs/common';
import { PermissionsChangelogService } from './permissions-changelog.service';

/**
 * @Global() — feature modules (RolesModule, etc.) can inject
 * PermissionsChangelogService without each importing this module.
 *
 * Must be registered in AppModule before any module that injects it.
 */
@Global()
@Module({
  providers: [PermissionsChangelogService],
  exports: [PermissionsChangelogService],
})
export class PermissionsChangelogModule {}
