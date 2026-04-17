/**
 * Logger — plain factory (not a React hook) for service-level logging.
 * Safe to call in non-component contexts (stores, managers, services).
 *
 * All log levels are gated behind __DEV__ — nothing reaches the console in
 * production builds. Wire up a crash reporter (Sentry / Crashlytics) separately
 * if you need production error visibility.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Creates a scoped logger that prefixes every message with `[namespace]`.
 *
 * @example
 * const log = createLogger('JWTManager');
 * log.info('Hydrated'); // → "[JWTManager] Hydrated"
 */
export function createLogger(namespace: string): Logger {
  const prefix = `[${namespace}]`;

  return {
    debug(message, ...args) {
      if (__DEV__) console.debug(prefix, message, ...args);
    },
    info(message, ...args) {
      if (__DEV__) console.log(prefix, message, ...args);
    },
    warn(message, ...args) {
      if (__DEV__) console.warn(prefix, message, ...args);
    },
    error(message, ...args) {
      if (__DEV__) console.error(prefix, message, ...args);
    },
  };
}
