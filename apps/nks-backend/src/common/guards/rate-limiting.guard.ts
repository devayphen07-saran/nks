import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { TooManyRequestsException } from '../exceptions';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import type { AuthenticatedRequest } from './auth.guard';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { lt, sql } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';
import { rateLimitEntries } from '../../core/database/schema';
import {
  RATE_LIMIT_KEY,
  SKIP_RATE_LIMIT_KEY,
} from '../decorators/rate-limit.decorator';

type Db = NodePgDatabase<typeof schema>;

/**
 * Rate Limiting Guard — database-backed sliding window.
 *
 * Uses the `rate_limit_entries` PostgreSQL table (migration 022) so that
 * limits survive restarts and are shared across all replica instances.
 *
 * Limits: 100 requests per 15-minute window per IP.
 * Cleanup: rows older than 1 hour are deleted on every check (fire-and-forget
 * — does not block the request path).
 *
 * Must be registered as a NestJS provider (not instantiated with `new`):
 *   providers: [RateLimitingGuard]
 *   @UseGuards(RateLimitingGuard)
 *
 * Note: not currently applied to any controller — register when needed.
 * Note: if DB overhead is unacceptable, swap in @nestjs/throttler with
 *   ThrottlerModule.forRoot([{ ttl: 900_000, limit: 100 }]), but that store
 *   is still in-memory and resets on restart unless a Redis adapter is added.
 */
@Injectable()
export class RateLimitingGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitingGuard.name);

  private readonly EXEMPT_IPS: string[];
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly DEFAULT_MAX_REQUESTS = 100;

  constructor(
    @InjectDb() private readonly db: Db,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    // Comma-separated IPs in RATE_LIMIT_EXEMPT_IPS env var, e.g. "10.0.0.1,10.0.0.2"
    const exemptIpsConfig =
      this.configService.get<string>('RATE_LIMIT_EXEMPT_IPS') ?? '';
    this.EXEMPT_IPS = exemptIpsConfig
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.getClientIp(request);

    if (this.EXEMPT_IPS.includes(clientIp)) {
      return true;
    }

    // Per-endpoint limit via @RateLimit(n), falls back to global default
    const maxRequests =
      this.reflector.getAllAndOverride<number | undefined>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? this.DEFAULT_MAX_REQUESTS;

    // Composite key: IP + authenticated userId (if present) + deviceId + path.
    // Prevents VPN rotation bypass: switching IPs while authenticated still shares
    // the same counter. Anonymous requests (pre-auth endpoints) key on IP alone.
    const authedRequest = request as Partial<AuthenticatedRequest>;
    const userId = authedRequest.user?.userId;
    const deviceId = (
      request.headers['x-device-id'] as string | undefined
    )?.slice(0, 64);
    const key = `${clientIp}:${userId ?? 'anon'}:${deviceId ?? 'web'}:${request.path}`;

    const now = new Date();
    const windowCutoff = new Date(now.getTime() - this.WINDOW_MS);

    const windowExpiresAt = new Date(now.getTime() + this.WINDOW_MS);

    // Fire-and-forget: delete expired rows without blocking the request
    void this.db
      .delete(rateLimitEntries)
      .where(lt(rateLimitEntries.expiresAt, now))
      .catch((err: unknown) => {
        this.logger.error(
          `Rate-limit cleanup failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

    // Upsert: insert first hit for this IP+path, or increment within window,
    // or reset the window if the stored windowStart has expired.
    const rows = await this.db
      .insert(rateLimitEntries)
      .values({ key, hits: 1, windowStart: now, expiresAt: windowExpiresAt })
      .onConflictDoUpdate({
        target: rateLimitEntries.key,
        set: {
          hits: sql`CASE
            WHEN ${rateLimitEntries.windowStart} < ${windowCutoff}
            THEN 1
            ELSE ${rateLimitEntries.hits} + 1
          END`,
          windowStart: sql`CASE
            WHEN ${rateLimitEntries.windowStart} < ${windowCutoff}
            THEN ${now}
            ELSE ${rateLimitEntries.windowStart}
          END`,
          expiresAt: sql`CASE
            WHEN ${rateLimitEntries.windowStart} < ${windowCutoff}
            THEN ${windowExpiresAt}
            ELSE ${rateLimitEntries.expiresAt}
          END`,
        },
      })
      .returning({ hits: rateLimitEntries.hits });

    const hits = rows[0]?.hits ?? 1;

    if (hits > maxRequests) {
      this.logger.warn(
        `Rate limit exceeded: key=${key} (${hits}/${maxRequests} hits)`,
      );
      // Pass retryAfter (in seconds) so the global exception filter can set
      // the Retry-After header dynamically instead of hardcoding 60s.
      const retryAfterSec = Math.ceil(this.WINDOW_MS / 1000);
      throw new TooManyRequestsException({
        message: 'Too Many Requests',
        meta: { retryAfter: retryAfterSec },
      });
    }

    return true;
  }

  private getClientIp(request: Request): string {
    return request.ip ?? 'unknown';
  }
}
