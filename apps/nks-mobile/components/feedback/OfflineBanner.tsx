import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useOfflineMode } from "../../lib/offline-mode";

/**
 * OfflineBanner: Shows at the top of the screen when offline mode is active.
 * Indicates to the user that they are operating without internet and data may be
 * synced later.
 *
 * Shown when:
 * - Device has NO internet, AND
 * - OfflineSession is valid (within 7-day window)
 *
 * Hidden when:
 * - Device is online
 * - Offline session has expired
 */
export function OfflineBanner() {
  const { isOffline, isSessionExpired } = useOfflineMode();

  // Show "Offline Mode" banner when offline and session is still valid
  if (isOffline) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>📡 Offline Mode</Text>
        <Text style={styles.subtext}>Data will sync when connection returns</Text>
      </View>
    );
  }

  // Show "Session Expired" error when offline but session has passed
  if (isSessionExpired) {
    return (
      <View style={[styles.container, styles.expired]}>
        <Text style={[styles.text, styles.expiredText]}>⚠️ Session Expired</Text>
        <Text style={[styles.subtext, styles.expiredText]}>
          Connect to internet to continue
        </Text>
      </View>
    );
  }

  // Nothing to show when online
  return null;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFF3CD",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#FFE69C",
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    color: "#856404",
  },
  subtext: {
    fontSize: 12,
    color: "#856404",
    marginTop: 2,
  },
  expired: {
    backgroundColor: "#F8D7DA",
    borderBottomColor: "#F5C6CB",
  },
  expiredText: {
    color: "#721C24",
  },
});
