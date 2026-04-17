import { Tabs } from "expo-router";
import { LucideIcon } from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";

export default function PersonalTabsLayout() {
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
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => (
            <LucideIcon name="BarChart3" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="expense"
        options={{
          title: "Expense",
          tabBarIcon: ({ color }) => (
            <LucideIcon name="Wallet" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <LucideIcon name="User" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
