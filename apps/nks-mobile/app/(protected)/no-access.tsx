import { View, Text, StyleSheet } from "react-native";
import { useLogoutConfirmation } from "../../hooks/useLogoutConfirmation";

/**
 * Shown when a SUPER_ADMIN account logs in on the mobile app.
 * The mobile app is for store users only — SUPER_ADMIN must use the web portal.
 */
export default function NoAccessScreen() {
  const { confirmLogout } = useLogoutConfirmation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account not supported</Text>
      <Text style={styles.message}>
        This app is for store users only. Super admin accounts must use the web
        portal.
      </Text>
      <Text style={styles.link} onPress={() => confirmLogout()}>
        Log out
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    textAlign: "center",
    color: "#666",
    lineHeight: 22,
  },
  link: {
    fontSize: 15,
    color: "#df005c",
    marginTop: 8,
  },
});
