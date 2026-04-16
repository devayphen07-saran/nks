/**
 * OfflineStatusBanner — JWT-aware offline countdown banner.
 *
 * Urgency tiers:
 *   none     → device is online  → hidden
 *   low      → offline, > 12h   → amber  "Offline mode • 2d 4h left"
 *   medium   → offline, < 12h   → orange "Offline expires in 8h 30m left • sync soon"
 *   high     → offline, < 2h    → red    "Offline expires in 45m left • connect now"
 *   expired  → JWT expired       → red    "Session expired • connect to continue"
 *
 * Replaces the old OfflineBanner (which used the 5-day OfflineSession).
 * Drop-in: place at the top of your root layout.
 *
 * Usage:
 *   <OfflineStatusBanner />
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useOfflineStatus } from "../../hooks/useOfflineStatus";
import { useMobileTheme } from "@nks/mobile-theme";

export function OfflineStatusBanner() {
  const { urgency, label } = useOfflineStatus();
  const { theme } = useMobileTheme();

  if (urgency === "none") return null;

  const tierConfig = {
    low: {
      backgroundColor: theme.colorWarningBg,
      borderBottomColor: theme.colorWarningBorder,
      textColor: theme.colorWarning,
      icon: "📶",
      title: "Offline mode",
    },
    medium: {
      backgroundColor: theme.colorWarningBg,
      borderBottomColor: theme.colorWarningBorder,
      textColor: theme.colorOrange,
      icon: "⏱",
      title: "Offline expires soon",
    },
    high: {
      backgroundColor: theme.colorErrorBg,
      borderBottomColor: theme.colorErrorBorder,
      textColor: theme.colorError,
      icon: "⚠️",
      title: "Connect now",
    },
    expired: {
      backgroundColor: theme.colorErrorBg,
      borderBottomColor: theme.colorErrorBorder,
      textColor: theme.colorError,
      icon: "🔒",
      title: "Session expired",
    },
  } as const;

  const tier = tierConfig[urgency];

  const subtitle =
    urgency === "expired"
      ? "Connect to internet to continue"
      : urgency === "high"
        ? `${label} • connect now`
        : urgency === "medium"
          ? `${label} • sync soon`
          : label ?? "Data will sync when connection returns";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: tier.backgroundColor,
          borderBottomColor: tier.borderBottomColor,
        },
      ]}
    >
      <Text style={[styles.title, { color: tier.textColor }]}>
        {tier.icon} {tier.title}
      </Text>
      <Text style={[styles.subtitle, { color: tier.textColor }]}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
