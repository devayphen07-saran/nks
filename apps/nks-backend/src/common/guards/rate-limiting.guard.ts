import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Rate Limiting Guard (standalone — does not require @nestjs/throttler)
 *
 * Simple in-memory IP-based rate limiter using a sliding window.
 * For production, install @nestjs/throttler and extend ThrottlerGuard instead.
 *
 * Usage:
 *   @UseGuards(RateLimitingGuard)
 *   @Controller('auth')
 *   export class AuthController {}
 */
@Injectable()
export class RateLimitingGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitingGuard.name);

  /** IP addresses exempt from rate limiting */
  private readonly EXEMPT_IPS: string[] = [];

  /** In-memory request counts: IP → { count, windowStart } */
  private readonly requests = new Map<
    string,
    { count: number; windowStart: number }
  >();

  /** Default: 100 requests per 15-minute window */
  private readonly WINDOW_MS = 15 * 60 * 1000;
  private readonly MAX_REQUESTS = 100;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.getClientIp(request);

    if (this.EXEMPT_IPS.includes(clientIp)) {
      return true;
    }

    const now = Date.now();
    const entry = this.requests.get(clientIp);

    if (!entry || now - entry.windowStart > this.WINDOW_MS) {
      this.requests.set(clientIp, { count: 1, windowStart: now });
      return true;
    }

    entry.count++;
    if (entry.count > this.MAX_REQUESTS) {
      this.logger.warn(
        `Rate limit exceeded: ${clientIp} → ${request.method} ${request.path}`,
      );
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
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
