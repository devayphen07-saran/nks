import { useCallback } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMobileTheme } from "@nks/mobile-theme";
import { Header, LucideIcon } from "@nks/mobile-ui-components";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { syncManager } from "../../lib/sync/sync-manager";
import { ROUTES } from "../../lib/navigation/routes";

function formatAgo(tsMs: number | null): string {
  if (!tsMs) return "Never";
  const diffMs = Date.now() - tsMs;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function healthColor(health: string, theme: any): string {
  switch (health) {
    case "synced":      return theme.colorSuccess;
    case "stale":       return theme.colorWarning;
    case "never_synced": return theme.colorTextSecondary;
    default:            return theme.colorTextSecondary;
  }
}

export function SyncStatusScreen() {
  const { theme } = useMobileTheme();
  const { status, isSyncing, isOnline, unsyncedCount, attentionCount } = useSyncStatus();

  const handleForceSync = useCallback(() => {
    syncManager.forceSync().catch(() => {});
  }, []);

  const handleDeadLetter = useCallback(() => {
    router.push(ROUTES.DEAD_LETTER);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colorBgLayout }]}>
      <Header
        title="Sync Status"
        leftElement={
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <LucideIcon name="ChevronLeft" size={24} color={theme.colorText} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isSyncing} onRefresh={handleForceSync} />
        }
      >
        {/* Connection + sync state */}
        <View style={[styles.card, { backgroundColor: theme.colorBgContainer, borderColor: theme.colorBorderSecondary }]}>
          <Row label="Network" value={isOnline ? "Online" : "Offline"} valueColor={isOnline ? theme.colorSuccess : theme.colorError} theme={theme} />
          <Divider theme={theme} />
          <Row
            label="Status"
            value={isSyncing ? "Syncing…" : "Idle"}
            valueColor={isSyncing ? theme.colorPrimary : theme.colorTextSecondary}
            theme={theme}
            right={isSyncing ? <ActivityIndicator size={14} color={theme.colorPrimary} /> : undefined}
          />
          <Divider theme={theme} />
          <Row
            label="Last full sync"
            value={formatAgo(status?.lastFullSyncAt ?? null)}
            theme={theme}
          />
        </View>

        {/* Mutation queue */}
        <SectionTitle title="Mutation Queue" theme={theme} />
        <View style={[styles.card, { backgroundColor: theme.colorBgContainer, borderColor: theme.colorBorderSecondary }]}>
          <Row label="Pending" value={String(status?.queue.pending ?? 0)} valueColor={theme.colorWarning} theme={theme} />
          <Divider theme={theme} />
          <Row label="In Progress" value={String(status?.queue.inProgress ?? 0)} theme={theme} />
          <Divider theme={theme} />
          <Row label="Failed" value={String(status?.queue.failed ?? 0)} valueColor={status?.queue.failed ? theme.colorError : undefined} theme={theme} />
          <Divider theme={theme} />
          <Row
            label="Quarantined"
            value={String(status?.queue.quarantined ?? 0)}
            valueColor={status?.queue.quarantined ? theme.colorError : undefined}
            theme={theme}
          />
        </View>

        {/* Per-table status */}
        <SectionTitle title="Tables" theme={theme} />
        <View style={[styles.card, { backgroundColor: theme.colorBgContainer, borderColor: theme.colorBorderSecondary }]}>
          {status
            ? Object.values(status.tables).map((t, idx, arr) => (
                <View key={t.table}>
                  <Row
                    label={t.table}
                    value={t.health.replace("_", " ")}
                    valueColor={healthColor(t.health, theme)}
                    subValue={t.lastSyncedAt ? formatAgo(t.lastSyncedAt) : undefined}
                    theme={theme}
                  />
                  {idx < arr.length - 1 && <Divider theme={theme} />}
                </View>
              ))
            : <ActivityIndicator color={theme.colorPrimary} style={{ padding: 16 }} />}
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colorPrimary }]}
          onPress={handleForceSync}
          disabled={isSyncing || !isOnline}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, { color: theme.colorBgContainer }]}>
            {isSyncing ? "Syncing…" : "Force Sync Now"}
          </Text>
        </TouchableOpacity>

        {attentionCount > 0 && (
          <TouchableOpacity
            style={[styles.button, styles.buttonOutline, { borderColor: theme.colorError }]}
            onPress={handleDeadLetter}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, { color: theme.colorError }]}>
              View {attentionCount} Failed Operation{attentionCount !== 1 ? "s" : ""}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ title, theme }: { title: string; theme: any }) {
  return (
    <Text style={[styles.sectionTitle, { color: theme.colorTextSecondary }]}>
      {title}
    </Text>
  );
}

function Divider({ theme }: { theme: any }) {
  return <View style={[styles.divider, { backgroundColor: theme.colorBorderSecondary }]} />;
}

function Row({
  label,
  value,
  valueColor,
  subValue,
  right,
  theme,
}: {
  label: string;
  value: string;
  valueColor?: string;
  subValue?: string;
  right?: React.ReactNode;
  theme: any;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.colorText }]}>{label}</Text>
      <View style={styles.rowRight}>
        {subValue && (
          <Text style={[styles.subValue, { color: theme.colorTextSecondary }]}>
            {subValue}
          </Text>
        )}
        <Text style={[styles.rowValue, { color: valueColor ?? theme.colorText }]}>
          {value}
        </Text>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 8 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: "600" },
  subValue: { fontSize: 12 },
  divider: { height: 1, marginHorizontal: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 4,
    marginLeft: 4,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
