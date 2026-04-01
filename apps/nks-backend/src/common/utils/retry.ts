import { Logger } from '@nestjs/common';

/**
 * Retry Logic with Exponential Backoff
 *
 * Retries a failing operation with exponential backoff delays.
 * Useful for handling transient failures (network issues, database locks, etc).
 *
 * @example
 * const result = await retryAsync(
 *   () => db.delete(...),
 *   { maxRetries: 3, initialDelayMs: 1000 }
 * );
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    initialDelayMs?: number;
    logger?: Logger;
    logLabel?: string;
  },
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const initialDelayMs = options?.initialDelayMs ?? 1000;
  const logger = options?.logger;
  const label = options?.logLabel ?? 'Operation';

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1 && logger) {
        logger.log(`✅ ${label} succeeded on attempt ${attempt}/${maxRetries}`);
      }
      return result;
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);

        if (logger) {
          logger.warn(
            `⚠️ ${label} attempt ${attempt}/${maxRetries} failed, retrying in ${delayMs}ms`,
            {
              error: lastError.message,
              attempt,
              nextRetryMs: delayMs,
            },
          );
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        if (logger) {
          logger.error(`❌ ${label} failed after ${maxRetries} attempts`, {
            error: lastError.message,
            attempt,
          });
        }
      }
    }
  }

  throw lastError || new Error(`${label} failed after ${maxRetries} retries`);
}

/**
 * Retry with custom backoff strategy
 *
 * @example
 * const result = await retryWithBackoff(
 *   () => fetch(url),
 *   (error, attempt) => {
 *     if (error.message.includes('429')) return 5000; // 5s for rate limit
 *     return 1000 * Math.pow(2, attempt - 1); // exponential backoff
 *   },
 *   3
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  getDelayMs: (error: Error, attempt: number) => number,
  maxRetries: number = 3,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delayMs = getDelayMs(lastError, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error(`Failed after ${maxRetries} retries`);
}

/**
 * Non-blocking retry with callback
 *
 * Retries a task but doesn't block the main request.
 * Useful for fire-and-forget operations (e.g., updating lastActiveAt).
 *
 * @example
 * // Fire-and-forget with retry
 * fireAndForgetWithRetry(
 *   () => db.update(...),
 *   { maxRetries: 3, logger }
 * );
 */
export function fireAndForgetWithRetry(
  fn: () => Promise<void>,
  options?: {
    maxRetries?: number;
    initialDelayMs?: number;
    logger?: Logger;
    logLabel?: string;
  },
): void {
  // Don't await - return immediately
  retryAsync(fn, options).catch((error) => {
    if (options?.logger) {
      options.logger.error(
        `❌ Background task failed: ${options?.logLabel || 'Operation'}`,
        { error: (error as Error).message },
      );
    }
  });
}
