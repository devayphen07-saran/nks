// ─── Global Type Augmentation ─────────────────────────────────────────────────
import "./types/styled.d.ts";

// ─── Token objects ────────────────────────────────────────────────────────────
export { mobileThemeTokens, lightTheme, darkTheme } from "./tokens";

// ─── Token types ──────────────────────────────────────────────────────────────
export type { NKSTheme } from "./tokens";
export type {
  SizeType,
  FontSizeType,
  ColorValueType,
  ColorVariantKey,
  SemanticColorMap,
} from "./tokens";
export { ColorType } from "./tokens";




// ─── Design token building blocks (for consumers needing granular access) ─────
export {
  fontSize,
  fontFamily,
  fontWeight,
  lineHeight,
  typographyTokens,
  sizing,
  spacing,
  borderRadius,
  borderWidth,
  lightSemanticColors,
  lightColorTokens,
  lightExtendedPalette,
  darkSemanticColors,
  darkColorTokens,
  darkExtendedPalette,
} from "./tokens";

// ─── React layer ──────────────────────────────────────────────────────────────
export {
  MobileThemeProvider,
  MobileThemeContext,
  useMobileTheme,
  useColorVariant,
} from "./ThemeProvider";

export type {
  MobileThemeContextType,
  MobileThemeProviderProps,
  ColorPlace,
} from "./ThemeProvider";
