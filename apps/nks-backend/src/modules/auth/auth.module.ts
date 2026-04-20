import { Global, Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { OtpController } from './controllers/otp.controller';
import { AuthCoreModule } from './auth-core.module';
import { SecurityModule } from './services/security/security.module';
import { ProvidersModule } from './services/providers/providers.module';
import { AuthPermissionsModule } from './services/permissions/permissions.module';
import { OtpModule } from './services/otp/otp.module';
import { AuthSessionModule } from './services/session/session.module';
import { AuthTokenModule } from './services/token/token.module';
import { AuthFlowsModule } from './services/flows/flows.module';
import { RolesModule } from '../roles/roles.module';

/**
 * AuthModule — global authentication module.
 *
 * Dependency direction (MUST stay acyclic):
 *   AuthModule → RolesModule → StoresModule
 *
 * CONSTRAINT: RolesModule and StoresModule must NEVER import AuthModule.
 * AuthPermissionsModule and AuthTokenModule import RolesModule directly for
 * their own providers; this top-level import makes RolesRepository available
 * to any auth submodule that does not redeclare it.
 *
 * RoutesModule is intentionally NOT imported here — no auth service depends
 * on RoutesService or RoutesRepository. Routes access is handled by the
 * routes module independently in AppModule.
 */
@Global()
@Module({
  imports: [
    RolesModule,
    AuthCoreModule,
    SecurityModule,
    ProvidersModule,
    AuthPermissionsModule,
    OtpModule,
    AuthSessionModule,
    AuthTokenModule,
    AuthFlowsModule,
  ],
  controllers: [OtpController, AuthController],
  exports: [
    // Re-export submodules so all their providers are globally available
    AuthCoreModule,
    SecurityModule,
    ProvidersModule,
    AuthPermissionsModule,
    OtpModule,
    AuthSessionModule,
    AuthTokenModule,
    AuthFlowsModule,
  ],
})
export class AuthModule {}
