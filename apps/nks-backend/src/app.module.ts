import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { RequestIdMiddleware } from './common/middlewares';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StoreModule } from './modules/store/store.module';
import { RolesModule } from './modules/roles/roles.module';
import { LookupModule } from './modules/lookup/lookup.module';
import { GeographyModule } from './modules/geography/geography.module';
import { LoggerModule } from './core/logger/logger.module';
import { StaffInviteModule } from './modules/staff-invite/staff-invite.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    StoreModule,
    RolesModule,
    LookupModule,
    GeographyModule,
    LoggerModule,
    StaffInviteModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
