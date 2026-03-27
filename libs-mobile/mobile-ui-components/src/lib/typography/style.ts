import { NKSTheme } from "@nks/mobile-theme";
import { TextStyle } from "react-native";
import { ColorType } from "@nks/mobile-theme";

/* ---------------- VARIANTS ---------------- */

export const variantTypography: Record<string, (theme: NKSTheme) => TextStyle> = {
  h1: (theme) => ({
    fontSize: theme.fontSize.h1,
    fontWeight: "700",
    fontFamily: theme.fontFamily.poppinsBold,
  }),

  h2: (theme) => ({
    fontSize: theme.fontSize.h2,
    fontWeight: "700",
    fontFamily: theme.fontFamily.poppinsBold,
  }),

  h3: (theme) => ({
    fontSize: theme.fontSize.h3,
    fontWeight: "600",
    fontFamily: theme.fontFamily.poppinsBold,
  }),

  h4: (theme) => ({
    fontSize: theme.fontSize.h4,
    fontWeight: "600",
    fontFamily: theme.fontFamily.poppinsSemiBold,
  }),

  h5: (theme) => ({
    fontSize: theme.fontSize.h5,
    fontWeight: "500",
    fontFamily: theme.fontFamily.poppinsSemiBold,
  }),

  subtitle: (theme) => ({
    fontSize: theme.fontSize.regular,
    fontWeight: "500",
    fontFamily: theme.fontFamily.poppinsRegular,
    color: theme.colorTextSecondary,
  }),

  body: (theme) => ({
    fontSize: theme.fontSize.small,
    fontWeight: "400",
    fontFamily: theme.fontFamily.poppinsRegular,
  }),

  caption: (theme) => ({
    fontSize: theme.fontSize.xSmall,
    fontWeight: "400",
    fontFamily: theme.fontFamily.poppinsRegular,
  }),

  overline: (theme) => ({
    fontSize: theme.fontSize.xxSmall,
    fontWeight: "400",
    fontFamily: theme.fontFamily.poppinsRegular,
  }),
};

/* ---------------- WEIGHTS ---------------- */

export const weightTypography: Record<string, (theme: NKSTheme) => TextStyle> = {
  bold: (theme) => ({
    fontWeight: "700",
    fontFamily: theme.fontFamily.poppinsBold,
  }),

  medium: (theme) => ({
    fontWeight: "600",
    fontFamily: theme.fontFamily.poppinsMedium,
  }),

  semiBold: (theme) => ({
    fontWeight: "600",
    fontFamily: theme.fontFamily.poppinsSemiBold,
  }),

  light: (theme) => ({
    fontWeight: "300",
    fontFamily: theme.fontFamily.poppinsLight,
  }),

  normal: () => ({}),
};

/* ---------------- TYPES ---------------- */

export type TypographyType = "primary" | "secondary" | "default";

export const typeTypography: Record<TypographyType, (theme: NKSTheme) => TextStyle> = {
  primary: (theme) => ({
    color: theme.color.primary.main,
  }),

  secondary: (theme) => ({
    color: theme.color.secondary.active,
  }),

  default: (theme) => ({
    color: theme.colorText,
  }),
};

/* ---------------- COLOR HELPER ---------------- */

export const getColorFromTheme = (theme: NKSTheme, colorType?: ColorType) => {
  if (!colorType) return undefined;
  return theme.color[colorType]?.main || theme.colorText;
};
