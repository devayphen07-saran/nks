import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Triggers a light physical impact, ideal for small UI interactions
 * (e.g., ticking a checkbox, expanding a subtle accordion).
 */
export const hapticLightImpact = () => {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
};

/**
 * Triggers a medium physical impact, ideal for standard button presses
 * or list item selection.
 */
export const hapticMediumImpact = () => {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }
};

/**
 * Triggers a heavy physical impact, ideal for major destructive actions or
 * finalizing a major state (e.g., deleting an item).
 */
export const hapticHeavyImpact = () => {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }
};

/**
 * Triggers a success notification pattern. Use exclusively when
 * a complex process succeeds (e.g., successful payment, order saved).
 */
export const hapticSuccess = () => {
  if (Platform.OS !== "web") {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
};

/**
 * Triggers an error notification pattern. Use exclusively to indicate
 * failure (e.g., invalid PIN, network error).
 */
export const hapticError = () => {
  if (Platform.OS !== "web") {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }
};

/**
 * Triggers a warning notification pattern.
 */
export const hapticWarning = () => {
  if (Platform.OS !== "web") {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }
};

/**
 * Triggers single selection feedback, often used when scrolling through a
 * wheel picker or slider. Overuse can cause muddy feedback.
 */
export const hapticSelection = () => {
  if (Platform.OS !== "web") {
    Haptics.selectionAsync().catch(() => {});
  }
};
