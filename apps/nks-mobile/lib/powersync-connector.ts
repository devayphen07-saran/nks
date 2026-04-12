/**
 * PowerSync Connector — bridges PowerSync SDK with the NKS backend.
 *
 * Two responsibilities:
 *   fetchCredentials() → GET /api/v1/sync/powersync-token
 *     Returns the PowerSync endpoint + 5-min RS256 JWT for the SDK WebSocket.
 *
 *   uploadData(database) → POST /api/v1/sync/push
 *     Drains the PowerSync CRUD queue and pushes operations to the backend.
 *     Guarded by assertWriteAllowed() — blocks if offline JWT expired.
 */

import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from "@powersync/react-native";
import { JWTManager } from "./jwt-manager";
import { assertWriteAllowed } from "./write-guard";
import { createLogger } from "./logger";
import { fetchWithTimeout } from "./fetch-with-timeout";
import { DeviceManager } from "./device-manager";

const log = createLogger("PowerSyncConnector");

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

// PowerSync endpoint (WebSocket URL for the PowerSync cloud/self-hosted instance)
// Set EXPO_PUBLIC_POWERSYNC_URL in your .env file.
const POWERSYNC_URL =
  process.env.EXPO_PUBLIC_POWERSYNC_URL ?? "https://your-instance.powersync.journeyapps.com";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const accessToken = JWTManager.getRawAccessToken();
  const fingerprint = await DeviceManager.getHeaderValue().catch(() => "");

  return {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(fingerprint ? { "X-Device-Fingerprint": fingerprint } : {}),
  };
}

export class NKSPowerSyncConnector implements PowerSyncBackendConnector {
  /**
   * Called by PowerSync SDK when it needs credentials to open (or re-open)
   * a sync WebSocket connection. Must return a short-lived token.
   */
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const headers = await getAuthHeaders();

    try {
      const res = await fetchWithTimeout(
        `${API_BASE}/sync/powersync-token`,
        { method: "GET", headers },
        10_000,
      );

      if (!res.ok) {
        log.warn(`fetchCredentials failed: HTTP ${res.status}`);
        return null;
      }

      const body = await res.json();
      const token: string = body?.data?.token ?? body?.token;
      const expiresAt: number | undefined = body?.data?.expiresAt ?? body?.expiresAt;

      if (!token) {
        log.warn("fetchCredentials: empty token in response");
        return null;
      }

      log.info("PowerSync credentials fetched");
      return {
        endpoint: POWERSYNC_URL,
        token,
        ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
      };
    } catch (err) {
      log.error("fetchCredentials error:", err);
      return null;
    }
  }

  /**
   * Called by PowerSync SDK when the upload queue has pending operations.
   * Reads all CRUD entries from the queue, batches them, and posts to the backend.
   * Blocks (throws) if the offline JWT has expired — prevents stale writes.
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    // Block writes if offline window expired
    assertWriteAllowed();

    const tx = await database.getNextCrudTransaction();
    if (!tx) return;

    const operations = tx.crud.map((op) => ({
      id: op.id,
      op: op.op.toUpperCase(),          // PUT | PATCH | DELETE
      table: op.table,
      opData: op.opData ?? {},
      idempotencyKey: op.clientId,
    }));

    const headers = await getAuthHeaders();

    try {
      const res = await fetchWithTimeout(
        `${API_BASE}/sync/push`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ operations }),
        },
        20_000,
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        log.warn(`uploadData failed: HTTP ${res.status}`, body);
        // Don't complete the transaction — SDK will retry
        return;
      }

      await tx.complete();
      log.info(`uploadData: ${operations.length} operation(s) pushed`);
    } catch (err) {
      log.error("uploadData error:", err);
      // Don't complete — SDK will retry on next trigger
    }
  }
}

/** Singleton connector instance */
export const powerSyncConnector = new NKSPowerSyncConnector();
