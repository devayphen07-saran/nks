import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { RequestIdMiddleware } from './common/middleware';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { AuthGuard } from './common/guards/auth.guard';
import { GuardsModule } from './common/guards/guards.module';
import { MailModule } from './shared/mail/mail.module';
import { AuthModule } from './contexts/iam/auth/auth.module';
import { RolesModule } from './contexts/iam/roles/roles.module';
import { RoutesModule } from './contexts/iam/routes/routes.module';
import { UsersModule } from './contexts/iam/users/users.module';
import { StoresModule } from './contexts/organization/stores/stores.module';
import { LocationModule } from './contexts/reference-data/location/location.module';
import { LookupsModule } from './contexts/reference-data/lookups/lookups.module';
import { CodesModule } from './contexts/reference-data/codes/codes.module';
import { StatusModule } from './contexts/reference-data/status/status.module';
import { EntityStatusModule } from './contexts/reference-data/entity-status/entity-status.module';
import { AuditModule } from './contexts/compliance/audit/audit.module';
import { SyncModule } from './contexts/sync/sync.module';
import { LoggerModule } from './core/logger/logger.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
    GuardsModule,
    LoggerModule,
    MailModule,
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
    StoresModule,
  ],
  controllers: [],
  providers: [
    /**
     * DEFAULT-DENY authentication — flips from opt-in to opt-out.
     *
     * Every route requires a valid session by default. Routes that should
     * be publicly accessible must be decorated with @Public() (which sets
     * the IS_PUBLIC_KEY metadata that AuthGuard reads and skips auth for).
     *
     * Previously each controller had to remember @UseGuards(AuthGuard).
     * Now forgetting the decorator keeps the route protected rather than
     * accidentally leaving it open.
     *
     * Controllers that currently declare @UseGuards(AuthGuard) explicitly
     * can remove it — the global guard makes it redundant. Controllers
     * using @UseGuards(AuthGuard, RBACGuard) should slim to @UseGuards(RBACGuard).
     */
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
