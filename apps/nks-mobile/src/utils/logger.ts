/**
 * Simple Logger Utility
 * Provides debug, log, warn, and error logging with category prefix
 */

export class Logger {
  private category: string;
  private isDevelopment = __DEV__; // React Native environment variable

  constructor(category: string) {
    this.category = category;
  }

  /**
   * Debug level logging (only in development)
   */
  debug(message: string, data?: unknown): void {
    if (this.isDevelopment) {
      console.log(`[${this.category}] ${message}`, data || '');
    }
  }

  /**
   * Info level logging
   */
  log(message: string, data?: unknown): void {
    console.log(`[${this.category}] ${message}`, data || '');
  }

  /**
   * Warning level logging
   */
  warn(message: string, error?: unknown): void {
    console.warn(`[${this.category}] ⚠️ ${message}`, error || '');
  }

  /**
   * Error level logging
   */
  error(message: string, error?: unknown): void {
    console.error(`[${this.category}] ❌ ${message}`, error || '');
  }
}

export default Logger;
