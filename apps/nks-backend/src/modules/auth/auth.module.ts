import { Global, Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { OtpController } from './controllers/otp.controller';
import { AuthService } from './services/auth.service';
import { OtpService } from './services/otp.service';
import { Msg91Service } from './services/msg91.service';
import { PasswordService } from './services/password.service';
import { OtpRateLimitService } from './services/otp-rate-limit.service';
import { RolesModule } from '../roles/roles.module';
import { RoutesModule } from '../routes/routes.module';
import { getAuth } from './config/better-auth';
import { BETTER_AUTH_TOKEN } from './auth.constants';
import { DATABASE_TOKEN } from '../../core/database/database.constants';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../core/database/schema';

@Global()
@Module({
  imports: [RolesModule, RoutesModule],
  controllers: [OtpController, AuthController],
  providers: [
    AuthService,
    OtpService,
    Msg91Service,
    PasswordService,
    OtpRateLimitService,
    {
      provide: BETTER_AUTH_TOKEN,
      inject: [DATABASE_TOKEN],
      useFactory: (db: NodePgDatabase<typeof schema>) => getAuth(db),
    },
  ],
  exports: [AuthService, OtpService, PasswordService, OtpRateLimitService, BETTER_AUTH_TOKEN],
})
export class AuthModule {}
