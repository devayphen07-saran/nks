import { Drawer } from "expo-router/drawer";

export default function StoreDashboardLayout() {
  return (
    <Drawer screenOptions={{ headerShown: false }}>
      <Drawer.Screen name="index" options={{ title: "Dashboard" }} />
    </Drawer>
  );
}
