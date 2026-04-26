import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../database/inject-db.decorator';
import * as schema from '../database/schema';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { SkipRateLimit } from '../../common/decorators/rate-limit.decorator';

type Db = NodePgDatabase<typeof schema>;

/**
 * Liveness and readiness endpoints for container orchestrators.
 *
 *  - GET /health/live   — process is running (no dependency checks).
 *    Used by Kubernetes livenessProbe. Failing this restarts the pod.
 *  - GET /health/ready  — process is running AND can serve traffic
 *    (runs `SELECT 1` against Postgres). Used by readinessProbe.
 *    Failing this removes the pod from the Service endpoints list
 *    until it recovers, but does NOT restart the pod.
 *
 * Both are @Public so the global AuthGuard skips them — probes never
 * send credentials. HTTP status is the contract k8s reads; the JSON
 * body is purely for humans.
 */
@ApiTags('Health')
@Controller('health')
@SkipRateLimit()
export class HealthController {
  constructor(@InjectDb() private readonly db: Db) {}

  @Get('live')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Alive')
  @ApiOperation({ summary: 'Liveness probe — process is running' })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Ready')
  @ApiOperation({
    summary: 'Readiness probe — DB reachable and pod can serve traffic',
  })
  async ready(): Promise<{ status: 'ok'; db: 'ok' }> {
    try {
      await this.db.execute(sql`select 1`);
    } catch (err) {
      throw new ServiceUnavailableException({
        status: 'error',
        db: 'unreachable',
        message: (err as Error).message,
      });
    }
    return { status: 'ok', db: 'ok' };
  }
}
