import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useMobileTheme } from "@nks/mobile-theme";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { ROUTES } from "../../lib/navigation/routes";

/**
 * SyncIndicator — compact pill for the Header rightElement.
 *
 * States:
 *   syncing      → spinner  (blue)
 *   pending      → "N pending" (amber) — mutations waiting to push
 *   attention    → "N failed" (red)   — quarantined/failed mutations
 *   synced       → "Synced" (green)   — all clear
 *   offline      → "Offline" (gray)   — no network
 *
 * Tapping navigates to the sync status screen.
 */
export function SyncIndicator() {
  const { theme } = useMobileTheme();
  const { isSyncing, isOnline, unsyncedCount, attentionCount } = useSyncStatus();

  function handlePress() {
    router.push(ROUTES.SYNC_STATUS);
  }

  let bgColor: string;
  let textColor: string;
  let label: string;
  let showSpinner = false;

  if (!isOnline) {
    bgColor = theme.colorBorderSecondary;
    textColor = theme.colorTextSecondary;
    label = "Offline";
  } else if (isSyncing) {
    bgColor = theme.colorPrimaryBg;
    textColor = theme.colorPrimary;
    label = "Syncing";
    showSpinner = true;
  } else if (attentionCount > 0) {
    bgColor = theme.colorErrorBg;
    textColor = theme.colorError;
    label = `${attentionCount} failed`;
  } else if (unsyncedCount > 0) {
    bgColor = theme.colorWarningBg;
    textColor = theme.colorWarning;
    label = `${unsyncedCount} pending`;
  } else {
    bgColor = theme.colorSuccessBg;
    textColor = theme.colorSuccess;
    label = "Synced";
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={[styles.pill, { backgroundColor: bgColor }]}
    >
      {showSpinner && (
        <ActivityIndicator size={10} color={textColor} style={styles.spinner} />
      )}
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  spinner: {
    marginRight: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
});
