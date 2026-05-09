import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { TooManyRequestsException } from '../exceptions';
import type { Request } from 'express';
import type { AuthenticatedRequest } from './auth.guard';
import {
  RATE_LIMIT_KEY,
  SKIP_RATE_LIMIT_KEY,
} from '../decorators/rate-limit.decorator';
import { RateLimitService } from './services/rate-limit.service';

/**
 * Sliding-window rate limiter. Decision-only — DB work lives in RateLimitService.
 *
 * Key strategy:
 *   Authenticated  →  rl:user:{userId}
 *   Anonymous      →  rl:ip:{ip}:{Class.handler}
 *
 * Handler key derives from ExecutionContext, not request.path, so trailing
 * slashes / query strings / `:id` parameters can't fragment the bucket.
 * deviceId is intentionally excluded — client-supplied and rotatable.
 */
@Injectable()
export class RateLimitingGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitingGuard.name);

  private readonly WINDOW_MS = 15 * 60 * 1000;
  private readonly DEFAULT_MAX = 100;
  private readonly EXEMPT_IPS: string[];

  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly reflector: Reflector,
    config: ConfigService,
  ) {
    const ips = config.get<string>('RATE_LIMIT_EXEMPT_IPS') ?? '';
    this.EXEMPT_IPS = ips.split(',').map((i) => i.trim()).filter(Boolean);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.shouldSkip(context)) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip ?? 'unknown';

    if (this.EXEMPT_IPS.includes(ip)) return true;

    const max = this.getMaxLimit(context);
    const key = this.buildKey(context, req, ip);

    const hits = await this.rateLimitService.recordHit(key, this.WINDOW_MS);

    if (hits > max) {
      this.logger.warn(`Rate limit exceeded: ${key} (${hits}/${max})`);
      throw new TooManyRequestsException({
        message: 'Too Many Requests',
        meta: { retryAfter: Math.ceil(this.WINDOW_MS / 1000) },
      });
    }

    return true;
  }

  private shouldSkip(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }

  private getMaxLimit(context: ExecutionContext): number {
    return (
      this.reflector.getAllAndOverride<number>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? this.DEFAULT_MAX
    );
  }

  private buildKey(context: ExecutionContext, req: Request, ip: string): string {
    const userId = (req as Partial<AuthenticatedRequest>).user?.userId;
    if (userId) return `rl:user:${userId}`;
    const handler = `${context.getClass().name}.${context.getHandler().name}`;
    return `rl:ip:${ip}:${handler}`;
  }
}
