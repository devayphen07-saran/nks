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

const TIER_STYLES = {
  low: {
    container: { backgroundColor: "#FFF3CD", borderBottomColor: "#FFE69C" },
    icon: "📶",
    title: "Offline mode",
    textColor: "#856404",
  },
  medium: {
    container: { backgroundColor: "#FFE0B2", borderBottomColor: "#FFCC80" },
    icon: "⏱",
    title: "Offline expires soon",
    textColor: "#E65100",
  },
  high: {
    container: { backgroundColor: "#FFCDD2", borderBottomColor: "#EF9A9A" },
    icon: "⚠️",
    title: "Connect now",
    textColor: "#B71C1C",
  },
  expired: {
    container: { backgroundColor: "#F8D7DA", borderBottomColor: "#F5C6CB" },
    icon: "🔒",
    title: "Session expired",
    textColor: "#721C24",
  },
} as const;

export function OfflineStatusBanner() {
  const { urgency, label, mode } = useOfflineStatus();

  if (urgency === "none") return null;

  const tier = TIER_STYLES[urgency];

  const subtitle =
    urgency === "expired"
      ? "Connect to internet to continue"
      : urgency === "high"
        ? `${label} • connect now`
        : urgency === "medium"
          ? `${label} • sync soon`
          : label ?? "Data will sync when connection returns";

  return (
    <View style={[styles.container, tier.container]}>
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
