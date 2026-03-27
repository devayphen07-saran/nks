import type { ColorValueType, SemanticColorMap } from "./types";

// ─── Semantic color groups ────────────────────────────────────────────────────

const primary: ColorValueType = {
  bg: "#EEF2FF",
  bgActive: "#E0E7FF",
  bgSecondary: "#F5F7FF",
  bgSecondaryActive: "#EEF2FF",
  border: "#C7D2FE",
  borderActive: "#A5B4FC",
  active: "#6366F1",
  main: "#4F46E5",
  onMain: "#ffffff",
  text: "#3730A3",
  textActive: "#312E81",
};

const secondary: ColorValueType = {
  bg: "#f1f5f9",
  bgActive: "#e2e8f0",
  bgSecondary: "#f8fafc",
  bgSecondaryActive: "#f1f5f9",
  border: "#cbd5e1",
  borderActive: "#94a3b8",
  active: "#64748b",
  main: "#475569",
  onMain: "#ffffff",
  text: "#1e293b",
  textActive: "#0f172a",
};

const blue: ColorValueType = {
  bg: "#ECF0FF",
  bgActive: "#D7E3FF",
  bgSecondary: "#F9F9FF",
  bgSecondaryActive: "#ECF0FF",
  border: "#AAC7FF",
  borderActive: "#7BABFF",
  active: "#2775DC",
  main: "#0066cc",
  onMain: "#ffffff",
  text: "#0051A4",
  textActive: "#00458E",
};

const orange: ColorValueType = {
  bg: "#FFEEDE",
  bgActive: "#FFDDB8",
  bgSecondary: "#FFF8F4",
  bgSecondaryActive: "#FFEEDE",
  border: "#FFB95F",
  borderActive: "#EE9800",
  active: "#CA8100",
  main: "#f59e0b",
  onMain: "#ffffff",
  text: "#855300",
  textActive: "#754900",
};

const violet: ColorValueType = {
  bg: "#F6EDFF",
  bgActive: "#E9DDFF",
  bgSecondary: "#FEF7FF",
  bgSecondaryActive: "#F6EDFF",
  border: "#D0BCFF",
  borderActive: "#B89BFF",
  active: "#8758F2",
  main: "#8b5cf6",
  onMain: "#ffffff",
  text: "#612ACA",
  textActive: "#5516BE",
};

const green: ColorValueType = {
  bg: "#E8FFEE",
  bgActive: "#BFFFD8",
  bgSecondary: "#F4FFF5",
  bgSecondaryActive: "#E8FFEE",
  border: "#87D7AA",
  borderActive: "#6CBB90",
  active: "#35855E",
  main: "#00a86b",
  onMain: "#ffffff",
  text: "#005F3C",
  textActive: "#005233",
};

const red: ColorValueType = {
  bg: "#FFEDEA",
  bgActive: "#FFDAD6",
  bgSecondary: "#FFF8F7",
  bgSecondaryActive: "#FFEDEA",
  border: "#FFB4AB",
  borderActive: "#FF897E",
  active: "#CF4940",
  main: "#fb2c36",
  onMain: "#ffffff",
  text: "#9D2420",
  textActive: "#8C1716",
};

const warning: ColorValueType = {
  bg: "#FFEEDE",
  bgActive: "#FFDDB8",
  bgSecondary: "#FFF8F4",
  bgSecondaryActive: "#FFEEDE",
  border: "#FFB95F",
  borderActive: "#EE9800",
  active: "#CA8100",
  main: "#f59e0b",
  onMain: "#ffffff",
  text: "#855300",
  textActive: "#754900",
};

const defaultColor: ColorValueType = {
  bg: "#f5f5f5",
  bgActive: "#e0e0e0",
  bgSecondary: "#ffffff",
  bgSecondaryActive: "#f0f0f0",
  border: "#d1d5db",
  borderActive: "#9ca3af",
  active: "#c0c0c0",
  main: "#374151",
  onMain: "#ffffff",
  text: "#1f2937",
  textActive: "#111827",
};

const grey: ColorValueType = {
  bg: "#f9fafb",
  bgActive: "#f3f4f6",
  bgSecondary: "#fefefe",
  bgSecondaryActive: "#f9fafb",
  border: "#d1d5db",
  borderActive: "#9ca3af",
  active: "#6b7280",
  main: "#374151",
  onMain: "#ffffff",
  text: "#4b5563",
  textActive: "#111827",
};

// ─── Semantic map ─────────────────────────────────────────────────────────────

export const lightSemanticColors: SemanticColorMap = {
  primary,
  secondary,
  blue,
  orange,
  violet,
  green,
  red,
  danger: red,
  success: green,
  warning,
  default: defaultColor,
  grey,
};

// ─── Flat token map (design system compatibility) ─────────────────────────────

export const lightColorTokens = {
  colorPrimaryBg: "#EEF2FF",
  colorPrimaryBgHover: "#E0E7FF",
  colorPrimaryBorder: "#C7D2FE",
  colorPrimaryBorderHover: "#A5B4FC",
  colorPrimaryHover: "#6366F1",
  colorPrimary: "#4F46E5",
  onColorPrimary: "#ffffff",
  colorPrimaryActive: "#312E81",
  colorPrimaryTextHover: "#4F46E5",
  colorPrimaryText: "#3730A3",
  colorPrimaryTextActive: "#312E81",

  colorSuccessBg: green.bg,
  colorSuccessBgHover: green.bgActive,
  colorSuccessBorder: green.border,
  colorSuccessBorderHover: green.borderActive,
  colorSuccessHover: green.borderActive,
  colorSuccess: green.main,
  colorSuccessActive: green.active,
  colorSuccessTextHover: green.text,
  colorSuccessText: green.main,
  colorSuccessTextActive: green.textActive,

  colorWarningBg: warning.bg,
  colorWarningBgHover: warning.bgActive,
  colorWarningBorder: warning.border,
  colorWarningBorderHover: warning.borderActive,
  colorWarningHover: warning.borderActive,
  colorWarning: warning.main,
  colorWarningActive: warning.active,
  colorWarningTextHover: warning.text,
  colorWarningText: warning.main,
  colorWarningTextActive: warning.textActive,

  colorErrorBg: red.bg,
  colorErrorBgHover: red.bgActive,
  colorErrorBorder: red.border,
  colorErrorBorderHover: red.borderActive,
  colorErrorHover: red.borderActive,
  colorError: red.main,
  colorErrorActive: red.active,
  colorErrorTextHover: red.borderActive,
  colorErrorText: red.main,
  colorErrorTextActive: red.active,

  colorInfoBg: blue.bg,
  colorInfoBgHover: blue.bgActive,
  colorInfoBorder: blue.border,
  colorInfoBorderHover: blue.borderActive,
  colorInfoHover: blue.borderActive,
  colorInfo: "#1677ff",
  colorInfoActive: "#0958d9",
  colorInfoTextHover: "#4096ff",
  colorInfoText: "#1677ff",
  colorInfoTextActive: "#0958d9",

  colorLinkHover: blue.borderActive,
  colorLinkActive: blue.textActive,

  colorText: "#1E1B4B",
  colorTextSecondary: "#3730A3",
  colorTextTertiary: "#818CF8",
  colorTextQuaternary: "#C7D2FE",

  colorBorder: "#e2e8f0",
  colorBorderSecondary: "#f1f5f9",

  colorFill: "#00000026",
  colorFillSecondary: "#0000000f",
  colorFillTertiary: "#0000000a",
  colorFillQuaternary: "#00000005",

  colorBgContainer: "#ffffff",
  colorBgElevated: "#ffffff",
  colorBgLayout: "#F5F7FF",
  colorBgSpotlight: "#312E81",
  colorBgMask: "#1E1B4B73",

  colorWhite: "#ffffff",
  transparent: "transparent",
} as const;

// ─── Extended palette (full scale) ───────────────────────────────────────────

export const lightExtendedPalette = {
  colorBlue: blue.main,
  blueBg: "#baddff",
  colorGray: "#7e7b7b",
  colorOrange: orange.main,
  orangeBg: "#fde68a",
  colorViolet: violet.main,
  violetBg: "#E9DDFF",
  colorGreen: green.main,
  greenBg: "#E8FFEE",
  colorRed: red.main,
  redBg: "#ffc9c9",

  gradientLayoutBg:
    "linear-gradient(135deg, #eef2ff 0%, #ffffff 40%, #ffffff 80%, #eef2ff 100%)",

  blue1000: "#00458E",
  blue900: "#0051A4",
  blue800: "#2775DC",
  blue700: "#4A90F8",
  blue600: "#7BABFF",
  blue500: "#AAC7FF",
  blue400: "#D7E3FF",
  blue300: "#ECF0FF",
  blue200: "#F9F9FF",
  blue100: "#FDFBFF",

  orange1000: "#754900",
  orange900: "#855300",
  orange800: "#A76A00",
  orange700: "#CA8100",
  orange600: "#EE9800",
  orange500: "#FFB95F",
  orange400: "#FFDDB8",
  orange300: "#FFEEDE",
  orange200: "#FFF8F4",
  orange100: "#FFFBFF",

  violet1000: "#5516BE",
  violet900: "#612ACA",
  violet800: "#8758F2",
  violet700: "#A078FF",
  violet600: "#B89BFF",
  violet500: "#D0BCFF",
  violet400: "#E9DDFF",
  violet300: "#F6EDFF",
  violet200: "#FEF7FF",
  violet100: "#FFFBFF",

  red1000: "#8C1716",
  red900: "#9D2420",
  red800: "#CF4940",
  red700: "#F16256",
  red600: "#FF897E",
  red500: "#FFB4AB",
  red400: "#FFDAD6",
  red300: "#FFEDEA",
  red200: "#FFF8F7",
  red100: "#FFFBFF",

  green1000: "#005233",
  green900: "#005F3C",
  green800: "#35855E",
  green700: "#51A077",
  green600: "#6CBB90",
  green500: "#87D7AA",
  green400: "#A2F4C5",
  green300: "#BFFFD8",
  green200: "#E8FFEE",
  green100: "#F4FFF5",
} as const;
