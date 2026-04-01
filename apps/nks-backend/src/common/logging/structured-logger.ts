import { Logger as NestLogger } from '@nestjs/common';

/**
 * Structured Logging Service
 *
 * All logs are in JSON format with consistent structure for easy parsing by log aggregators
 * (Datadog, CloudWatch, ELK, etc).
 *
 * Format:
 * {
 *   "timestamp": "2024-03-25T10:30:45.123Z",
 *   "level": "info|warn|error|debug",
 *   "logger": "AuthController",
 *   "message": "User logged in",
 *   "userId": 123,
 *   "email": "user@example.com",
 *   "duration": 125,  // milliseconds
 *   "error": { "message": "...", "stack": "..." }  // only for errors
 * }
 */
export interface LogContext {
  [key: string]: string | number | boolean | Date | null | undefined | Record<string, unknown>;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'log' | 'warn' | 'error';
  logger: string;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  duration?: number;
}

export class StructuredLogger {
  private nestLogger: NestLogger;
  private context: string;

  constructor(context: string) {
    this.nestLogger = new NestLogger(context);
    this.context = context;
  }

  /**
   * Log at debug level (development only)
   *
   * @example
   * this.logger.debug('Token refreshed', {
   *   userId: 123,
   *   tokenExpiry: new Date(),
   * });
   */
  debug(message: string, context?: LogContext, duration?: number): void {
    this.logStructured('debug', message, context, undefined, duration);
  }

  /**
   * Log at info level (normal operation)
   *
   * @example
   * this.logger.info('User logged in', {
   *   userId: 123,
   *   email: 'user@example.com',
   *   loginMethod: 'password',
   * });
   */
  info(message: string, context?: LogContext, duration?: number): void {
    this.logStructured('log', message, context, undefined, duration);
  }

  /**
   * Log at warn level (something unexpected)
   *
   * @example
   * this.logger.warn('High latency detected', {
   *   endpoint: '/api/users',
   *   duration: 5000,
   *   threshold: 1000,
   * });
   */
  warn(message: string, context?: LogContext, duration?: number): void {
    this.logStructured('warn', message, context, undefined, duration);
  }

  /**
   * Log an error with full context
   *
   * @example
   * try {
   *   await db.query(...);
   * } catch (error) {
   *   this.logger.error('Database query failed', {
   *     query: 'SELECT * FROM users',
   *     timeout: 5000,
   *   }, error);
   * }
   */
  error(message: string, context?: LogContext, error?: Error | unknown): void {
    const err = this.normalizeError(error);
    this.logStructured('error', message, context, err);
  }

  /**
   * Log operation performance
   *
   * @example
   * const start = Date.now();
   * await db.query(...);
   * this.logger.perf('Database query', { query: 'SELECT...' }, Date.now() - start);
   */
  perf(message: string, context?: LogContext, durationMs?: number): void {
    this.logStructured('debug', message, context, undefined, durationMs);
  }

  /**
   * Log with automatic timing
   *
   * @example
   * await this.logger.time('Fetch user data', async () => {
   *   return await this.userService.find(123);
   * });
   */
  async time<T>(message: string, fn: () => Promise<T>, context?: LogContext): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.logStructured('debug', message, context, undefined, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      const err = this.normalizeError(error);
      this.logStructured('error', `${message} (failed)`, context, err, duration);
      throw error;
    }
  }

  /**
   * Log with sampling (useful for high-volume logs)
   *
   * @example
   * // Only log 1% of successful requests
   * this.logger.sample('Request completed', 0.01, { endpoint, duration });
   */
  sample(message: string, sampleRate: number, context?: LogContext, duration?: number): void {
    if (Math.random() < sampleRate) {
      this.logStructured('debug', message, context, undefined, duration);
    }
  }

  /**
   * Private: Unified logging function
   */
  private logStructured(
    level: 'debug' | 'log' | 'warn' | 'error',
    message: string,
    context?: LogContext,
    error?: { message: string; code?: string; stack?: string },
    duration?: number,
  ): void {
    // Never log sensitive data
    const safeContext = this.sanitizeContext(context);

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      logger: this.context,
      message,
      ...(safeContext && { context: safeContext }),
      ...(error && { error }),
      ...(duration !== undefined && { duration }),
    };

    const logMessage = JSON.stringify(entry);

    // Use NestJS logger for proper formatting
    switch (level) {
      case 'debug':
        this.nestLogger.debug(logMessage);
        break;
      case 'log':
        this.nestLogger.log(logMessage);
        break;
      case 'warn':
        this.nestLogger.warn(logMessage);
        break;
      case 'error':
        this.nestLogger.error(logMessage);
        break;
    }
  }

  /**
   * Remove sensitive data from logs
   */
  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;

    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'accessToken',
      'refreshToken',
      'apiKey',
      'creditCard',
      'ssn',
      'apiSecret',
      'privateKey',
    ];

    const sanitized: LogContext = {};

    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();

      if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (value instanceof Date) {
        sanitized[key] = value.toISOString();
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = '[OBJECT]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Normalize error objects
   */
  private normalizeError(error?: Error | unknown): {
    message: string;
    code?: string;
    stack?: string;
  } | undefined {
    if (!error) return undefined;

    if (error instanceof Error) {
      return {
        message: error.message,
        code: (error as any).code,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
      };
    }

    return {
      message: String(error),
    };
  }
}
