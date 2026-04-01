import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { RequestIdMiddleware } from './common/middlewares';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StoreModule } from './modules/store/store.module';
import { RolesModule } from './modules/roles/roles.module';
import { RoutesModule } from './modules/routes/routes.module';
import { LookupModule } from './modules/lookup/lookup.module';
import { LocationModule } from './modules/location/location.module';
import { LoggerModule } from './core/logger/logger.module';
import { StaffInviteModule } from './modules/staff-invite/staff-invite.module';
import { AdminModule } from './modules/admin/admin.module';
import { TaxModule } from './modules/tax/tax.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    StoreModule,
    RolesModule,
    RoutesModule,
    LookupModule,
    LocationModule,
    LoggerModule,
    StaffInviteModule,
    AdminModule,
    TaxModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
