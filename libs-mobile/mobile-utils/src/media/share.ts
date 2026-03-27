import * as Sharing from "expo-sharing";
import { Platform, Alert } from "react-native";

/**
 * Takes any local URI (like an invoice PDF just generated, or a receipt image)
 * and natively forces open the AirDrop / WhatsApp / SMS sharing schema directly on top of the app.
 *
 * Target Use Case: Instantly sending an invoice generation PDF directly to the buyer's WhatsApp.
 */
export const shareLocalFile = async (
  uri: string,
  dialogTitle = "Share File",
) => {
  try {
    const isAvailable = await Sharing.isAvailableAsync();

    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        dialogTitle: dialogTitle,
        UTI: "public.data",
      });
    } else {
      console.warn(
        "[ShareUtils] Native Sharing is unavailable on this architecture.",
      );
      if (Platform.OS === "web") {
        Alert.alert(
          "Sharing not supported in web simulator. Download the file instead.",
        );
      }
    }
  } catch (error) {
    console.error("[ShareUtils] Interrupted native sharing process.", error);
  }
};
