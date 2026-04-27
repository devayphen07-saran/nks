import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { TooManyRequestsException } from '../exceptions';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { AuthenticatedRequest } from './auth.guard';
import {
  RATE_LIMIT_KEY,
  SKIP_RATE_LIMIT_KEY,
} from '../decorators/rate-limit.decorator';
import { RateLimitService } from './services/rate-limit.service';

/**
 * RateLimitingGuard — sliding-window access control.
 *
 * Guard responsibility: decide allow / deny.
 * DB work (upsert, cleanup, window calculation) is delegated to RateLimitService.
 *
 * Key strategy (two dimensions):
 *   Authenticated  →  rl:user:{userId}          (stable, server-assigned)
 *   Anonymous      →  rl:ip:{ip}:{routeTemplate} (per-IP per-route-template)
 *
 * deviceId is excluded from both strategies: it is a client-supplied header
 * and can be rotated on every request to bypass limits entirely.
 */
@Injectable()
export class RateLimitingGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitingGuard.name);

  private readonly EXEMPT_IPS: string[];
  private readonly WINDOW_MS = 15 * 60 * 1000;
  private readonly DEFAULT_MAX_REQUESTS = 100;

  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    const exemptIpsConfig = this.configService.get<string>('RATE_LIMIT_EXEMPT_IPS') ?? '';
    this.EXEMPT_IPS = exemptIpsConfig.split(',').map((ip) => ip.trim()).filter(Boolean);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = request.ip ?? 'unknown';

    if (this.EXEMPT_IPS.includes(clientIp)) return true;

    const maxRequests =
      this.reflector.getAllAndOverride<number | undefined>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? this.DEFAULT_MAX_REQUESTS;

    const userId = (request as Partial<AuthenticatedRequest>).user?.userId;
    const key = userId
      ? `rl:user:${userId}`
      : `rl:ip:${clientIp}:${this.resolveRouteTemplate(request)}`;

    const hits = await this.rateLimitService.recordHit(key, this.WINDOW_MS);

    if (hits > maxRequests) {
      this.logger.warn(`Rate limit exceeded: key=${key} (${hits}/${maxRequests} hits)`);
      throw new TooManyRequestsException({
        message: 'Too Many Requests',
        meta: { retryAfter: Math.ceil(this.WINDOW_MS / 1000) },
      });
    }

    return true;
  }

  private resolveRouteTemplate(request: Request): string {
    return (request as Request & { route?: { path?: string } }).route?.path ?? request.path;
  }
}
