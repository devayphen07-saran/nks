import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AppValidationPipe } from './common/pipes';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ApiVersionMiddleware, CsrfMiddleware } from './common/middleware';
import { TimeoutInterceptor, ResponseInterceptor, LoggingInterceptor, SessionRotationInterceptor } from './common/interceptors';
import { CsrfService } from './common/csrf.service';
import { SessionRotationService } from './common/interceptors/session-rotation.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { AuthGuard } from './common/guards/auth.guard';
import { RateLimitingGuard } from './common/guards/rate-limiting.guard';
import { GuardsModule } from './common/guards/guards.module';
import { RateLimitingModule } from './common/guards/rate-limiting.module';
import { AuthModule } from './contexts/iam/auth/auth.module';
import { RolesModule } from './contexts/iam/roles/roles.module';
import { RoutesModule } from './contexts/iam/routes/routes.module';
import { UsersModule } from './contexts/iam/users/users.module';
import { StoresModule } from './contexts/organization/stores/stores.module';
import { LocationModule } from './contexts/reference-data/location/location.module';
import { LookupsModule } from './contexts/reference-data/lookups/lookups.module';
import { StatusModule } from './contexts/reference-data/status/status.module';
import { EntityStatusModule } from './contexts/reference-data/entity-status/entity-status.module';
import { AuditModule } from './contexts/compliance/audit/audit.module';
import { SyncModule } from './contexts/sync/sync.module';
import { PermissionsChangelogModule } from './shared/permissions-changelog/permissions-changelog.module';
import { LoggerModule } from './core/logger/logger.module';
import { HealthModule } from './core/health/health.module';

/**
 * Module dependency graph (acyclic — arrows show "imports"):
 *
 *   AppModule
 *     ├── ConfigModule          (global config, no upstream deps)
 *     ├── ClsModule             (global ALS request context — no upstream deps)
 *     ├── DatabaseModule        (global DB pool, no upstream deps)
 *     ├── AuditModule                 (@Global — injected anywhere without import)
 *     ├── PermissionsChangelogModule  (@Global — injected anywhere without import)
 *     ├── GuardsModule          → DatabaseModule
 *     ├── AuthModule            → RolesModule → StoresModule → DatabaseModule
 *     │                         → RateLimitingModule, MailModule (shared/mail)
 *     ├── RolesModule           → StoresModule → DatabaseModule
 *     ├── RoutesModule          → DatabaseModule
 *     ├── UsersModule           → DatabaseModule
 *     ├── StoresModule          → DatabaseModule
 *     ├── SyncModule            → AuthModule (for guards)
 *     └── Reference-data modules (Location, Lookups, Codes, Status, EntityStatus)
 *           → DatabaseModule only
 *
 * CONSTRAINT: RolesModule, StoresModule must NEVER import AuthModule (circular).
 * CONSTRAINT: AuthModule must NEVER import SyncModule (circular).
 */
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    HealthModule,
    GuardsModule,
    RateLimitingModule,
    LoggerModule,
    AuditModule,
    PermissionsChangelogModule,
    AuthModule,
    RolesModule,
    RoutesModule,
    LocationModule,
    LookupsModule,
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
    CsrfService,
    SessionRotationService,
    { provide: APP_FILTER,      useClass: GlobalExceptionFilter },
    { provide: APP_PIPE,        useClass: AppValidationPipe },
    { provide: APP_GUARD,       useClass: AuthGuard },
    { provide: APP_GUARD,       useClass: RateLimitingGuard },
    { provide: APP_INTERCEPTOR, useClass: SessionRotationInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ApiVersionMiddleware, CsrfMiddleware).forRoutes('*');
  }
}
