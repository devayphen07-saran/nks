/**
 * Token Mutation Mutex
 * Prevents concurrent token refresh and logout operations from causing race conditions
 * ✅ CRITICAL FIX #3: Ensures atomic token state transitions
 */

export class TokenMutex {
  private isRefreshing = false;
  private refreshPromise: Promise<unknown> | null = null;
  private isClearing = false;
  private clearPromise: Promise<unknown> | null = null;

  /**
   * Executes a refresh operation with mutual exclusion.
   * If a refresh is already in progress, waits for it to complete and returns undefined
   * (caller should read the current in-memory token — the in-flight refresh already updated it).
   * If a clear is in progress, throws immediately.
   */
  async withRefreshLock<T>(fn: () => Promise<T>): Promise<T | undefined> {
    // Abort if clear is in progress
    if (this.isClearing) {
      throw new Error("Token clear in progress, cannot refresh");
    }

    // If a refresh is already running, wait for it then signal the caller to
    // re-read the token rather than issuing a second refresh.
    if (this.isRefreshing && this.refreshPromise) {
      // Swallow the error — the original caller handles it; waiters just retry.
      await this.refreshPromise.catch(() => {});
      return undefined;
    }

    this.isRefreshing = true;
    this.refreshPromise = fn().finally(() => {
      this.isRefreshing = false;
      this.refreshPromise = null;
    });

    return this.refreshPromise as Promise<T>;
  }

  /**
   * Executes a clear operation with mutual exclusion.
   * Waits for any in-flight refresh to complete before clearing.
   */
  async withClearLock<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for any in-flight refresh — swallow its error so logout is never
    // blocked by a failed refresh attempt.
    if (this.isRefreshing && this.refreshPromise) {
      await this.refreshPromise.catch(() => {});
    }

    // Now perform clear with exclusive access
    this.isClearing = true;
    this.clearPromise = fn().finally(() => {
      this.isClearing = false;
      this.clearPromise = null;
    });

    return this.clearPromise as Promise<T>;
  }
}

// Global singleton instance
export const tokenMutex = new TokenMutex();
