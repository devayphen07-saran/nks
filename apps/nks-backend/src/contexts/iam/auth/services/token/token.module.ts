import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../../auth-core.module';
import { AuthPermissionsModule } from '../permissions/permissions.module';
import { SecurityModule } from '../security/security.module';
import { RolesModule } from '../../../roles/roles.module';
import { TokenService } from './token.service';
import { TokenLifecycleService } from './token-lifecycle.service';
import { JtiBlocklistService } from './jti-blocklist.service';

/**
 * AuthTokenModule — JWT issuance, validation, and refresh token rotation.
 */
@Module({
  imports: [AuthCoreModule, AuthPermissionsModule, SecurityModule, RolesModule],
  providers: [TokenService, TokenLifecycleService, JtiBlocklistService],
  exports: [TokenService, TokenLifecycleService, JtiBlocklistService],
})
export class AuthTokenModule {}
