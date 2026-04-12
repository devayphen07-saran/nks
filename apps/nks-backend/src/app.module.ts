import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { RequestIdMiddleware } from './common/middleware';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { RolesModule } from './modules/roles/roles.module';
import { RoutesModule } from './modules/routes/routes.module';
import { LocationModule } from './modules/location/location.module';
import { LookupsModule } from './modules/lookups/lookups.module';
import { CodesModule } from './modules/codes/codes.module';
import { UsersModule } from './modules/users/users.module';
import { StatusModule } from './modules/status/status.module';
import { EntityStatusModule } from './modules/entity-status/entity-status.module';
import { LoggerModule } from './core/logger/logger.module';
import { AuditModule } from './modules/audit/audit.module';
import { SyncModule } from './modules/sync/sync.module';
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    LoggerModule,
    AuditModule,
    AuthModule,
    RolesModule,
    RoutesModule,
    LocationModule,
    LookupsModule,
    CodesModule,
    UsersModule,
    StatusModule,
    EntityStatusModule,
    SyncModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
