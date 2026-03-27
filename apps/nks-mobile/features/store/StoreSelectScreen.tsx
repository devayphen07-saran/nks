import { View, Text, TouchableOpacity, FlatList } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../store";

export function StoreSelectScreen() {
  const authResponse = useAuth().authResponse;
  const roles = authResponse?.data?.access?.roles ?? [];
  const storeRoles = roles.filter(
    (r: any) =>
      r.storeId != null &&
      (r.roleCode === "STORE_OWNER" ||
        r.roleCode === "STAFF" ||
        r.roleCode === "STORE_MANAGER" ||
        r.roleCode === "CASHIER" ||
        r.roleCode === "DELIVERY"),
  );

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "bold", marginBottom: 16 }}>
        Select a store
      </Text>
      <FlatList
        data={storeRoles}
        keyExtractor={(item) => String(item.storeId)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{ padding: 16, marginBottom: 12, backgroundColor: "#f5f5f5", borderRadius: 8 }}
            onPress={() => router.replace("/(protected)/(workspace)/(app)/(store)/main")}
          >
            <Text style={{ fontSize: 16, fontWeight: "600" }}>
              {item.storeName ?? `Store #${item.storeId}`}
            </Text>
            <Text style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{item.roleCode}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
