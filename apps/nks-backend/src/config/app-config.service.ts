import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Typed facade over NestJS ConfigService for the values most commonly needed
 * across the application layer.
 *
 * Use this instead of configService.get<string>('NODE_ENV') === 'production'
 * scattered at call sites — raw string key lookups give no compile-time
 * guarantee and no IntelliSense on the returned type.
 *
 * Provided globally by ConfigModule; inject it wherever ConfigService would
 * otherwise be used only to read NODE_ENV or port.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  get nodeEnv(): string {
    return this.config.get<string>('app.nodeEnv') ?? 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isStaging(): boolean {
    return this.nodeEnv === 'staging';
  }

  get port(): number {
    return this.config.get<number>('app.port') ?? 4000;
  }

  get trustProxyHops(): number {
    return this.config.get<number>('app.trustProxyHops') ?? 1;
  }

  get csrfHmacSecret(): string {
    return this.config.get<string>('app.csrfHmacSecret') ?? '';
  }

  get csrfSameSite(): 'strict' | 'lax' | 'none' {
    return this.config.get<'strict' | 'lax' | 'none'>('app.csrfSameSite') ?? 'strict';
  }

  get allowedOrigins(): string[] {
    return this.config.get<string[]>('app.allowedOrigins') ?? ['http://localhost:3000'];
  }
}
