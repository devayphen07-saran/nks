import { Tabs } from "expo-router";
import { LucideIcon } from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";

export default function StoreTabsLayout() {
  const { theme } = useMobileTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colorPrimary,
        tabBarInactiveTintColor: theme.colorTextSecondary,
        tabBarStyle: {
          backgroundColor: theme.colorBgContainer,
          borderTopColor: theme.colorBorderSecondary,
          borderTopWidth: 1,
          height: 60,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <LucideIcon name="LayoutDashboard" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pos"
        options={{
          title: "POS",
          tabBarIcon: ({ color }) => (
            <LucideIcon name="ScanBarcode" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="supplier"
        options={{
          title: "Supplier",
          tabBarIcon: ({ color }) => (
            <LucideIcon name="Truck" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
