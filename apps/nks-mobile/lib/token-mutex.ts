/**
 * Token Mutation Mutex
 * Prevents concurrent token refresh and logout operations from causing race conditions
 * ✅ CRITICAL FIX #3: Ensures atomic token state transitions
 */

export class TokenMutex {
  private isRefreshing = false;
  private refreshPromise: Promise<any> | null = null;
  private isClearing = false;
  private clearPromise: Promise<any> | null = null;

  /**
   * Executes a refresh operation with mutual exclusion
   * If a refresh is already in progress, waits for it to complete
   * If a clear is in progress, aborts refresh
   */
  async withRefreshLock<T>(fn: () => Promise<T>): Promise<T | undefined> {
    // Abort if clear is in progress
    if (this.isClearing) {
      throw new Error("Token clear in progress, cannot refresh");
    }

    // Wait if refresh already in progress
    if (this.isRefreshing && this.refreshPromise) {
      await this.refreshPromise;
      return undefined;
    }

    this.isRefreshing = true;
    this.refreshPromise = fn()
      .then((result) => {
        this.isRefreshing = false;
        this.refreshPromise = null;
        return result;
      })
      .catch((error) => {
        this.isRefreshing = false;
        this.refreshPromise = null;
        throw error;
      });

    return this.refreshPromise;
  }

  /**
   * Executes a clear operation with mutual exclusion
   * Waits for any in-flight refresh to complete before clearing
   */
  async withClearLock<T>(fn: () => Promise<T>): Promise<T> {
    // Abort if refresh in progress
    if (this.isRefreshing) {
      // Wait for refresh to finish, then clear
      await this.refreshPromise;
    }

    // Now perform clear with exclusive access
    this.isClearing = true;
    this.clearPromise = fn()
      .then((result) => {
        this.isClearing = false;
        this.clearPromise = null;
        return result;
      })
      .catch((error) => {
        this.isClearing = false;
        this.clearPromise = null;
        throw error;
      });

    return this.clearPromise;
  }
}

// Global singleton instance
export const tokenMutex = new TokenMutex();
