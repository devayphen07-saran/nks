import { useEffect, useRef, useState } from "react";
import { getSyncStatus, type SyncStatus } from "../lib/sync/sync-status";
import { syncManager } from "../lib/sync/sync-manager";

const POLL_INTERVAL_MS = 5_000;

export interface SyncStatusResult {
  status: SyncStatus | null;
  isSyncing: boolean;
  isOnline: boolean;
  /** Unsynced = pending + in_progress mutations */
  unsyncedCount: number;
  /** Attention needed = failed + quarantined */
  attentionCount: number;
}

export function useSyncStatus(): SyncStatusResult {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [managerState, setManagerState] = useState(() => syncManager.getStatus());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refresh() {
    const [s, m] = await Promise.all([
      getSyncStatus(),
      Promise.resolve(syncManager.getStatus()),
    ]);
    setStatus(s);
    setManagerState(m);
  }

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    status,
    isSyncing: managerState.isSyncing,
    isOnline: managerState.isOnline,
    unsyncedCount: (status?.queue.pending ?? 0) + (status?.queue.inProgress ?? 0),
    attentionCount: (status?.queue.failed ?? 0) + (status?.queue.quarantined ?? 0),
  };
}
