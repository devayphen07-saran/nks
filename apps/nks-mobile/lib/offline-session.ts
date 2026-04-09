import { v4 as uuidv4 } from "uuid";
import {
  saveSecureItem,
  getSecureItem,
  deleteSecureItem,
} from "@nks/mobile-utils";

const OFFLINE_SESSION_KEY = "nks_offline_session";

/** 7-day offline trust window (milliseconds) */
export const OFFLINE_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * OfflineSession: Client-side trust policy for offline POS operations.
 * This is NOT a token — it's a local policy that says "this device was
 * authenticated within the last 7 days — allow local POS operations."
 */
export interface OfflineSession {
  /** Unique identifier for this offline session (UUID) — used in outbox audit trail */
  id: string;

  /** User ID from auth response */
  userId: number;

  /** Store ID selected during login */
  storeId: number;

  /** Store name for UI display */
  storeName: string;

  /** User roles from auth response */
  roles: string[];

  /** Unix timestamp — session is valid until this time. Only extends on successful server refresh. */
  offlineValidUntil: number;

  /** Timestamp of last successful data sync (products, customers, tax_rates) */
  lastSyncedAt: number;

  /** Cached RSA public key from GET /.well-known/jwks.json — for offline JWT verification */
  jwksPublicKey: string;

  /** Timestamp when this OfflineSession was created */
  createdAt: number;
}

export const offlineSession = {
  /**
   * Creates a new OfflineSession from auth response data.
   * Stores it in SecureStore immediately.
   * Must be called after successful login.
   */
  async create(input: {
    userId: number;
    storeId: number;
    storeName: string;
    roles: string[];
    jwksPublicKey: string;
  }): Promise<OfflineSession> {
    const session: OfflineSession = {
      id: uuidv4(),
      userId: input.userId,
      storeId: input.storeId,
      storeName: input.storeName,
      roles: input.roles,
      offlineValidUntil: Date.now() + OFFLINE_SESSION_DURATION_MS,
      lastSyncedAt: Date.now(),
      jwksPublicKey: input.jwksPublicKey,
      createdAt: Date.now(),
    };

    await saveSecureItem(OFFLINE_SESSION_KEY, JSON.stringify(session));
    return session;
  },

  /**
   * Loads the persisted OfflineSession from SecureStore.
   * Returns null if not found or JSON parsing fails.
   */
  async load(): Promise<OfflineSession | null> {
    try {
      const raw = await getSecureItem(OFFLINE_SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as OfflineSession;
    } catch {
      return null;
    }
  },

  /**
   * Checks if the loaded OfflineSession is still valid.
   * Valid means: offlineValidUntil > now.
   */
  isValid(session: OfflineSession | null): boolean {
    if (!session) return false;
    return session.offlineValidUntil > Date.now();
  },

  /**
   * Updates the offlineValidUntil timestamp (extends the session by 7 days).
   * Called on every successful token refresh.
   * Saves the updated session to SecureStore.
   */
  async extendValidity(session: OfflineSession): Promise<OfflineSession> {
    const updated = {
      ...session,
      offlineValidUntil: Date.now() + OFFLINE_SESSION_DURATION_MS,
    };
    await saveSecureItem(OFFLINE_SESSION_KEY, JSON.stringify(updated));
    return updated;
  },

  /**
   * Updates the lastSyncedAt timestamp and optionally jwksPublicKey.
   * Called after successful data sync.
   */
  async updateSync(
    session: OfflineSession,
    updates: {
      lastSyncedAt?: number;
      jwksPublicKey?: string;
    },
  ): Promise<OfflineSession> {
    const updated = {
      ...session,
      lastSyncedAt: updates.lastSyncedAt ?? session.lastSyncedAt,
      jwksPublicKey: updates.jwksPublicKey ?? session.jwksPublicKey,
    };
    await saveSecureItem(OFFLINE_SESSION_KEY, JSON.stringify(updated));
    return updated;
  },

  /**
   * Clears the OfflineSession from SecureStore.
   * Called on logout or remote wipe.
   */
  async clear(): Promise<void> {
    await deleteSecureItem(OFFLINE_SESSION_KEY);
  },
};
