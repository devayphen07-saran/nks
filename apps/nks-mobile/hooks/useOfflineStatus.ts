/**
 * useOfflineStatus — Reactive offline window countdown hook.
 *
 * Combines:
 *  - JWTManager.getOfflineStatus()  (offline JWT exp claim)
 *  - Network connectivity state     (expo-network)
 *
 * Polls every 60 seconds so the countdown UI stays accurate.
 * Also re-evaluates immediately on network state changes.
 *
 * Usage:
 *   const { mode, remainingMs, isOnline } = useOfflineStatus();
 */

import { useEffect, useRef, useState } from "react";
import * as Network from "expo-network";
import { JWTManager, type OfflineStatus, type OfflineMode } from '../lib/auth/jwt-manager';

const POLL_INTERVAL_MS = 5_000; // 5 seconds — fast detection of network restoration

export interface OfflineStatusResult extends OfflineStatus {
  isOnline: boolean;
  /** Urgency tier for UI colour-coding */
  urgency: "none" | "low" | "medium" | "high" | "expired";
  /** Formatted human-readable label, e.g. "2d 4h left" */
  label: string | null;
}

function computeUrgency(
  mode: OfflineMode,
  remainingMs: number | null,
  isOnline: boolean,
): OfflineStatusResult["urgency"] {
  if (isOnline) return "none";
  if (mode === "offline_expired") return "expired";

  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

  if (!remainingMs) return "expired";
  if (remainingMs < TWO_HOURS_MS) return "high";
  if (remainingMs < TWELVE_HOURS_MS) return "medium";
  return "low";
}

function formatRemaining(ms: number | null): string | null {
  if (ms === null || ms <= 0) return null;

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

async function fetchNetworkState(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return (state.isConnected && state.isInternetReachable) ?? false;
  } catch {
    return false;
  }
}

export function useOfflineStatus(): OfflineStatusResult {
  const [isOnline, setIsOnline] = useState(true);
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus>(() =>
    JWTManager.getOfflineStatus(),
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function refresh(online: boolean) {
    const status = JWTManager.getOfflineStatus();
    setOfflineStatus(status);
    setIsOnline(online);
  }

  useEffect(() => {
    // Initial network check
    fetchNetworkState().then((online) => refresh(online));

    // Poll every 60s
    intervalRef.current = setInterval(async () => {
      const online = await fetchNetworkState();
      refresh(online);
    }, POLL_INTERVAL_MS);

    // Listen to network state changes for immediate response
    const subscription = Network.addNetworkStateListener((state) => {
      const online = (state.isConnected && state.isInternetReachable) ?? false;
      refresh(online);
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      subscription.remove();
    };
  }, []);

  const urgency = computeUrgency(offlineStatus.mode, offlineStatus.remainingMs, isOnline);
  const label = isOnline ? null : formatRemaining(offlineStatus.remainingMs);

  return {
    ...offlineStatus,
    isOnline,
    urgency,
    label,
  };
}
