/**
 * Offline Session Status
 * Machine-readable status types for offline session state.
 * Human-readable presentation (labels, icons) belongs in the UI layer.
 */

import { ONE_HOUR_MS, ONE_DAY_MS } from "@nks/utils";
import type { OfflineSession } from "./offline-session";
import { isSessionValid, isRolesStale } from "./offline-session-validator";

export type SessionStatus = "active" | "expiring" | "expired" | "stale_roles" | "no_session";

export interface StatusMessage {
  status: SessionStatus;
  message: string;
}

/**
 * Get the current offline session status.
 * Returns a machine-readable status and a plain descriptive message.
 * UI layers are responsible for adding icons, colors, and translations.
 */
export function getStatusMessage(session: OfflineSession | null): StatusMessage {
  if (!session) {
    return { status: "no_session", message: "Not authenticated" };
  }

  if (!isSessionValid(session)) {
    return { status: "expired", message: "Offline session expired" };
  }

  const rolesStatus = isRolesStale(session);
  if (rolesStatus.isStale) {
    return {
      status: "stale_roles",
      message: `Roles may be stale (${rolesStatus.reason}). Go online to sync.`,
    };
  }

  const now = Date.now();
  const timeRemaining = session.offlineValidUntil - now;
  const hoursRemaining = Math.round(timeRemaining / ONE_HOUR_MS);

  if (timeRemaining < ONE_DAY_MS) {
    return {
      status: "expiring",
      message: `Offline access expires in ${hoursRemaining}h. Go online to refresh.`,
    };
  }

  return {
    status: "active",
    message: `Offline access active for ${hoursRemaining}h. Roles: ${session.roles.length}`,
  };
}
