/**
 * Exponential backoff with full jitter.
 *
 * Base delays (seconds): 30s → 2m → 8m → 32m → 120m
 * Jitter: random value in [0, base_delay] so retrying devices don't all
 * wake up at the same moment after a server outage (thundering herd).
 *
 * Usage:
 *   const delayMs = backoffWithJitter(retryCount);
 *   await sleep(delayMs);
 */

const BASE_DELAYS_MS = [
  30_000,    // retry 0 → up to 30s
  120_000,   // retry 1 → up to 2m
  480_000,   // retry 2 → up to 8m
  1_920_000, // retry 3 → up to 32m
  7_200_000, // retry 4+ → up to 2h
];

/**
 * Returns a jittered delay for the given retry count.
 * Result is in [0, base_delay] — full jitter strategy.
 */
export function backoffWithJitter(retryCount: number): number {
  const base = BASE_DELAYS_MS[Math.min(retryCount, BASE_DELAYS_MS.length - 1)];
  return Math.floor(Math.random() * base);
}

/**
 * Returns the maximum possible delay for the given retry count (no jitter).
 * Use this when you need a deterministic upper bound (e.g. UI display).
 */
export function backoffMax(retryCount: number): number {
  return BASE_DELAYS_MS[Math.min(retryCount, BASE_DELAYS_MS.length - 1)];
}
