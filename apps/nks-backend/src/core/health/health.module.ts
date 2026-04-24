import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * HealthModule — liveness and readiness probes.
 *
 * Relies on the globally-registered DatabaseModule for the DB handle, so
 * no additional imports are required here. Must be imported by AppModule
 * or `/health/*` returns 404 to orchestrator probes.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
