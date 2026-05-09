import { Module } from '@nestjs/common';
import { PermissionsChangelogService } from './permissions-changelog.service';

/**
 * Consumer modules (RolesModule, etc.) must import this module explicitly
 * to surface PermissionsChangelogService coupling in the module graph.
 */
@Module({
  providers: [PermissionsChangelogService],
  exports: [PermissionsChangelogService],
})
export class PermissionsChangelogModule {}
