import { Platform, TextStyle } from "react-native";
import { NKSTheme } from "@nks/mobile-theme";

/* ---------------- Label ---------------- */

export const inputLabelStyles = (theme: NKSTheme): TextStyle => ({
  fontSize: theme.fontSize.xSmall,
  fontWeight: "500",
  marginBottom: theme.margin.xSmall,
  color: theme.colorText || "#333",
  fontFamily: theme.fontFamily.poppinsLight,
});

/* ---------------- Input ---------------- */

export const inputStyles = (theme: NKSTheme, hasError?: boolean): TextStyle => ({
  borderWidth: theme.borderWidth.borderWidthThin,
  borderColor: hasError ? theme.colorError : theme.colorBorder,
  borderRadius: theme.borderRadius.medium,
  padding: Platform.OS === "ios" ? theme.padding.small : 10,
  fontSize: theme.fontSize.small,
  fontFamily: theme.fontFamily.poppinsRegular,
  color: theme.colorText,
});
