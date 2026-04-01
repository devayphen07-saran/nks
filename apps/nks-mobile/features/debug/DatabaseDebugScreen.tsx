import { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, initializeDatabase } from "@nks/local-db";
import { useMobileTheme } from "@nks/mobile-theme";

export function DatabaseDebugScreen() {
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState({
    users: [] as any[],
    sessions: [] as any[],
    roles: [] as any[],
    flags: [] as any[],
  });
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadData = async () => {
    setRefreshing(true);
    try {
      await initializeDatabase();
      const authDb = useAuth();

      // Get first user
      const user = await authDb.getCurrentUser();
      const userId = user?.userId || 0;

      // Fetch users from database directly
      const db = await initializeDatabase();
      const users = await (db.collections.get('auth_users').query() as any).fetch();

      const [sessions, roles, flags] = await Promise.all([
        authDb.getSessionsByUserId(userId),
        authDb.getActiveRoles(userId),
        authDb.getAllFlags(),
      ]);

      setData({
        users: (users || []) as any[],
        sessions: (sessions || []) as any[],
        roles: (roles || []) as any[],
        flags: (flags || []) as any[],
      });

      // Format timestamp
      const now = new Date();
      const timeStr = now.toLocaleTimeString();
      setLastUpdated(timeStr);
    } catch (error) {
      console.error("Failed to load database debug data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={{ paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.colorText }}>
          🗄️ Database Debug
        </Text>
        {lastUpdated && (
          <Text style={{ fontSize: 12, color: theme.colorTextSecondary, marginTop: 4 }}>
            Last updated: {lastUpdated}
          </Text>
        )}
      </View>

      {/* Refresh Button */}
      <TouchableOpacity
        onPress={loadData}
        disabled={refreshing}
        style={{
          marginHorizontal: 16,
          marginBottom: 16,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 6,
          backgroundColor: theme.colorPrimary,
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {refreshing ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Text style={{ color: "white", marginRight: 8 }}>🔄</Text>
        )}
        <Text style={{ color: "white", fontWeight: "600", fontSize: 13 }}>
          {refreshing ? "Loading..." : "Refresh Data"}
        </Text>
      </TouchableOpacity>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Auth Users */}
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
            borderLeftWidth: 4,
            borderLeftColor: theme.colorPrimary,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "bold", marginBottom: 8, color: theme.colorText }}>
            👤 Auth Users ({data.users.length})
          </Text>
          {data.users.length === 0 ? (
            <Text style={{ fontSize: 12, color: theme.colorTextSecondary, fontStyle: "italic" }}>
              No users found
            </Text>
          ) : (
            data.users.map((user, i) => (
              <View key={i} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: theme.colorText }}>
                  ID: {user.userId}
                </Text>
                <Text style={{ fontSize: 11, color: theme.colorText }}>
                  Name: {user.name || "N/A"}
                </Text>
                <Text style={{ fontSize: 11, color: theme.colorText }}>
                  Email: {user.email || "N/A"}
                </Text>
                <Text style={{ fontSize: 11, color: theme.colorText }}>
                  Admin: {user.isSuperAdmin ? "✓" : "✗"}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Auth Sessions */}
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
            borderLeftWidth: 4,
            borderLeftColor: "#0066FF",
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "bold", marginBottom: 8, color: theme.colorText }}>
            🔐 Auth Sessions ({data.sessions.length})
          </Text>
          {data.sessions.length === 0 ? (
            <Text style={{ fontSize: 12, color: theme.colorTextSecondary, fontStyle: "italic" }}>
              No sessions found
            </Text>
          ) : (
            data.sessions.map((session, i) => (
              <View key={i} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: theme.colorText }}>
                  SessionID: {session.sessionId?.slice(0, 16)}...
                </Text>
                <Text style={{ fontSize: 11, color: theme.colorText }}>
                  Token: {session.accessToken?.slice(0, 24)}...
                </Text>
                <Text style={{ fontSize: 11, color: theme.colorText }}>
                  Expired: {session.isAccessTokenExpired() ? "❌ Yes" : "✅ No"}
                </Text>
                <Text style={{ fontSize: 11, color: theme.colorText }}>
                  Needs Refresh: {session.needsRefresh() ? "⚠️ Yes" : "✅ No"}
                </Text>
                <Text style={{ fontSize: 11, color: theme.colorText }}>
                  Active: {session.isActive ? "✓" : "✗"}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Auth Roles */}
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
            borderLeftWidth: 4,
            borderLeftColor: "#FF9500",
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "bold", marginBottom: 8, color: theme.colorText }}>
            🎭 Auth Roles ({data.roles.length})
          </Text>
          {data.roles.length === 0 ? (
            <Text style={{ fontSize: 12, color: theme.colorTextSecondary, fontStyle: "italic" }}>
              No roles found
            </Text>
          ) : (
            data.roles.map((role, i) => (
              <View key={i} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: theme.colorText }}>
                  Code: {role.roleCode}
                </Text>
                <Text style={{ fontSize: 11, color: theme.colorText }}>
                  Store: {role.storeId ? `#${role.storeId}` : "Global"}
                </Text>
                <Text style={{ fontSize: 11, color: theme.colorText }}>
                  Active: {role.isActive ? "✓" : "✗"}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Feature Flags */}
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            borderLeftWidth: 4,
            borderLeftColor: "#34C759",
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "bold", marginBottom: 8, color: theme.colorText }}>
            🚩 Feature Flags ({data.flags.length})
          </Text>
          {data.flags.length === 0 ? (
            <Text style={{ fontSize: 12, color: theme.colorTextSecondary, fontStyle: "italic" }}>
              No flags found
            </Text>
          ) : (
            data.flags.map((flag, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 11, color: theme.colorText }}>
                  {flag.flagCode}:{" "}
                  <Text style={{ color: flag.isEnabled ? "#34C759" : "#FF3B30", fontWeight: "bold" }}>
                    {flag.isEnabled ? "✅ ON" : "❌ OFF"}
                  </Text>
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
