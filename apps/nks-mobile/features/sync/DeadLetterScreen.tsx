import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ListRenderItem,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMobileTheme } from "@nks/mobile-theme";
import { Header, LucideIcon } from "@nks/mobile-ui-components";
import { failedOperationsRepository, type FailedOperationItem } from "../../lib/database/repositories/failed-operations.repository";

function formatDate(unixMs: number): string {
  const d = new Date(unixMs);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DeadLetterScreen() {
  const { theme } = useMobileTheme();
  const [items, setItems] = useState<FailedOperationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const rows = await failedOperationsRepository.findUnresolved();
    setItems(rows);
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleResolve = useCallback(
    (item: FailedOperationItem) => {
      Alert.alert(
        "Mark as Resolved",
        `Mark "${item.entity}/${item.operation}" as resolved? This will remove it from this list. The data was NOT synced — resolve only if you've handled this manually.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Mark Resolved",
            style: "destructive",
            onPress: async () => {
              await failedOperationsRepository.markResolved(item.id);
              await load();
            },
          },
        ],
      );
    },
    [load],
  );

  const renderItem: ListRenderItem<FailedOperationItem> = useCallback(
    ({ item }) => (
      <View style={[styles.card, { backgroundColor: theme.colorBgContainer, borderColor: theme.colorBorderSecondary }]}>
        <View style={styles.cardHeader}>
          <View style={styles.entityBadge}>
            <Text style={[styles.entityText, { color: theme.colorError }]}>
              {item.entity}
            </Text>
            <Text style={[styles.opText, { color: theme.colorTextSecondary }]}>
              {" / "}{item.operation}
            </Text>
          </View>
          <Text style={[styles.dateText, { color: theme.colorTextSecondary }]}>
            {formatDate(item.failed_at)}
          </Text>
        </View>

        {item.error_msg && (
          <View style={[styles.errorBox, { backgroundColor: theme.colorErrorBg }]}>
            <Text style={[styles.errorText, { color: theme.colorError }]} numberOfLines={3}>
              {item.error_msg}
            </Text>
          </View>
        )}

        <View style={styles.payloadRow}>
          <Text style={[styles.payloadLabel, { color: theme.colorTextSecondary }]}>
            Payload
          </Text>
          <Text style={[styles.payloadValue, { color: theme.colorText }]} numberOfLines={2}>
            {JSON.stringify(item.payload)}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.resolveButton, { borderColor: theme.colorBorderSecondary }]}
          onPress={() => handleResolve(item)}
          activeOpacity={0.7}
        >
          <LucideIcon name="CheckCircle" size={14} color={theme.colorTextSecondary} />
          <Text style={[styles.resolveText, { color: theme.colorTextSecondary }]}>
            Mark Resolved
          </Text>
        </TouchableOpacity>
      </View>
    ),
    [theme, handleResolve],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colorBgLayout }]}>
      <Header
        title="Failed Operations"
        leftElement={
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <LucideIcon name="ChevronLeft" size={24} color={theme.colorText} />
          </TouchableOpacity>
        }
      />

      {isLoading ? (
        <ActivityIndicator
          color={theme.colorPrimary}
          style={{ marginTop: 40 }}
        />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <LucideIcon name="CheckCircle2" size={48} color={theme.colorSuccess} />
          <Text style={[styles.emptyTitle, { color: theme.colorText }]}>
            No failed operations
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colorTextSecondary }]}>
            All mutations have been synced or resolved.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  entityBadge: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  entityText: { fontSize: 14, fontWeight: "700" },
  opText: { fontSize: 14 },
  dateText: { fontSize: 12 },
  errorBox: {
    borderRadius: 8,
    padding: 10,
  },
  errorText: { fontSize: 12, lineHeight: 18 },
  payloadRow: { gap: 2 },
  payloadLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  payloadValue: { fontSize: 12, lineHeight: 18 },
  resolveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  resolveText: { fontSize: 13 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  emptyTitle: { fontSize: 17, fontWeight: "600" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
