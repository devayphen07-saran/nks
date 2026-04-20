import {
  saveSecureItem,
  getSecureItem,
  deleteSecureItem,
} from "./secure-store";

let _token: string | null = null;
let _onExpired: (() => void) | null = null;
let _onRefresh: (() => void) | null = null;
let _expiredFired = false;

const SESSION_KEY = "nks_session";

/**
 * Session data older than this triggers a background re-fetch.
 *
 * Set to ~50% of the access token TTL (15 min) so the proactive refresh
 * fires while the token is still valid. A value too close to the TTL
 * (e.g. 15 min) means the token is already expired when the refresh
 * runs, causing a 401 → reactive refresh race.
 */
export const SESSION_STALE_MS = 7 * 60 * 1000;

/** SecureStore hard limit is 2048 bytes — stay comfortably under. */
const MAX_BYTES = 1800;

/** Wraps persisted session data with the timestamp it was stored. */
export interface SessionEnvelope<T> {
  data: T;
  fetchedAt: number;
}

export const tokenManager = {
  /** Returns the current in-memory access token. Synchronous — no I/O. */
  get(): string | null {
    return _token;
  },

  /** Stores the access token in memory only. Never written to disk. */
  set(token: string): void {
    _token = token;
    _expiredFired = false;
  },

  /** Clears the in-memory access token. Call on logout initiation. */
  clear(): void {
    _token = null;
  },

  /**
   * Registers a callback that fires when a 401 is received.
   * Wired in store.ts to clear the session and dispatch unauthenticated.
   */
  onExpired(cb: () => void): void {
    _onExpired = cb;
  },

  /** Called by the Axios interceptor when a 401 response is received. Fires once until reset. */
  notifyExpired(): void {
    if (_expiredFired) return;
    _expiredFired = true;
    _onExpired?.();
  },

  /**
   * Registers a callback that fires when a 403 is received.
   * Wired in store.ts to trigger a silent background session refresh.
   */
  onRefresh(cb: () => void): void {
    _onRefresh = cb;
  },

  /** Called by the Axios interceptor when a 403 response is received. */
  notifyRefresh(): void {
    _onRefresh?.();
  },

  /**
   * Persists the auth response to SecureStore wrapped in a SessionEnvelope.
   * The optimized AuthResponse (without metadata/profile fields) fits comfortably
   * under the 2KB SecureStore limit for all user types.
   */
  async persistSession(data: any): Promise<void> {
    const envelope: SessionEnvelope<any> = { data, fetchedAt: Date.now() };
    const json = JSON.stringify(envelope);

    if (json.length > MAX_BYTES) {
      console.warn(
        '[Auth] Session data exceeds SecureStore limit — this should not happen with optimized AuthResponse.',
        { size: json.length, max: MAX_BYTES },
      );
    }

    await saveSecureItem(SESSION_KEY, json);
  },

  /**
   * Loads the persisted session from SecureStore.
   * Returns null if nothing is stored or JSON parsing fails.
   * Sessions stored without an envelope (old format) are treated as stale (fetchedAt=0).
   */
  async loadSession<T = unknown>(): Promise<SessionEnvelope<T> | null> {
    const raw = await getSecureItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!("fetchedAt" in parsed)) {
        return { data: parsed as T, fetchedAt: 0 };
      }
      return parsed as SessionEnvelope<T>;
    } catch {
      return null;
    }
  },

  /** Removes the persisted session from SecureStore. Call after server sign-out. */
  async clearSession(): Promise<void> {
    await deleteSecureItem(SESSION_KEY);
  },
};
