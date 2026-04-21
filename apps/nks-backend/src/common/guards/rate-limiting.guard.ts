import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { lt, sql } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';
import { rateLimitEntries } from '../../core/database/schema';
import { RATE_LIMIT_KEY } from '../decorators/rate-limit.decorator';

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
  private readonly CLEANUP_TTL_MS = 60 * 60 * 1000; // delete after 1 hour

  constructor(
    @InjectDb() private readonly db: Db,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    // Comma-separated IPs in RATE_LIMIT_EXEMPT_IPS env var, e.g. "10.0.0.1,10.0.0.2"
    const raw = this.configService.get<string>('RATE_LIMIT_EXEMPT_IPS') ?? '';
    this.EXEMPT_IPS = raw.split(',').map((ip) => ip.trim()).filter(Boolean);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    // Key includes the route path so each endpoint has its own counter per IP
    const key = `${clientIp}:${request.path}`;

    const now = new Date();
    const windowCutoff = new Date(now.getTime() - this.WINDOW_MS);
    const cleanupCutoff = new Date(now.getTime() - this.CLEANUP_TTL_MS);

    // Fire-and-forget: delete expired rows without blocking the request
    this.db
      .delete(rateLimitEntries)
      .where(lt(rateLimitEntries.windowStart, cleanupCutoff))
      .catch(() => {});

    // Upsert: insert first hit for this IP+path, or increment within window,
    // or reset the window if the stored windowStart has expired.
    const rows = await this.db
      .insert(rateLimitEntries)
      .values({ key, hits: 1, windowStart: now })
      .onConflictDoUpdate({
        target: rateLimitEntries.key,
        set: {
          // Reset window if expired; otherwise increment
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
        },
      })
      .returning({ hits: rateLimitEntries.hits });

    const hits = rows[0]?.hits ?? 1;

    if (hits > maxRequests) {
      this.logger.warn(
        `Rate limit exceeded: ${clientIp} → ${request.method} ${request.path} (${hits}/${maxRequests} hits)`,
      );
      // Pass retryAfter (in seconds) so the global exception filter can set
      // the Retry-After header dynamically instead of hardcoding 60s.
      const retryAfterSec = Math.ceil(this.WINDOW_MS / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too Many Requests',
          meta: { retryAfter: retryAfterSec },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips.split(',')[0].trim();
    }

    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    return request.socket.remoteAddress || 'unknown';
  }
}
