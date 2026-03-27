import type { ColorValueType, SemanticColorMap } from "./types";

// ─── Semantic color groups ────────────────────────────────────────────────────

const primary: ColorValueType = {
  bg: "#1E1B4B",
  bgActive: "#312E81",
  bgSecondary: "#0F0E17",
  bgSecondaryActive: "#1E1B4B",
  border: "#4338CA",
  borderActive: "#4F46E5",
  active: "#818CF8",
  main: "#818CF8",
  onMain: "#ffffff",
  text: "#C7D2FE",
  textActive: "#E0E7FF",
};

const secondary: ColorValueType = {
  bg: "#1a1a1a",
  bgActive: "#2d2d2d",
  bgSecondary: "#1f1f1f",
  bgSecondaryActive: "#1a1a1a",
  border: "#666666",
  borderActive: "#999999",
  active: "#cccccc",
  main: "#666666",
  onMain: "#ffffff",
  text: "#e6e6e6",
  textActive: "#ffffff",
};

const blue: ColorValueType = {
  bg: "#0d1a33",
  bgActive: "#13254d",
  bgSecondary: "#101f40",
  bgSecondaryActive: "#0d1a33",
  border: "#2775DC",
  borderActive: "#4A90F8",
  active: "#7BABFF",
  main: "#0066cc",
  onMain: "#ffffff",
  text: "#AAC7FF",
  textActive: "#D7E3FF",
};

const orange: ColorValueType = {
  bg: "#331f00",
  bgActive: "#4d2f00",
  bgSecondary: "#402800",
  bgSecondaryActive: "#331f00",
  border: "#CA8100",
  borderActive: "#EE9800",
  active: "#FFB95F",
  main: "#f59e0b",
  onMain: "#ffffff",
  text: "#FFDDB8",
  textActive: "#FFEEDE",
};

const violet: ColorValueType = {
  bg: "#1a0f33",
  bgActive: "#24154d",
  bgSecondary: "#1f1340",
  bgSecondaryActive: "#1a0f33",
  border: "#8758F2",
  borderActive: "#A078FF",
  active: "#B89BFF",
  main: "#8b5cf6",
  onMain: "#ffffff",
  text: "#D0BCFF",
  textActive: "#E9DDFF",
};

const green: ColorValueType = {
  bg: "#0a1f17",
  bgActive: "#0f3326",
  bgSecondary: "#0d2a20",
  bgSecondaryActive: "#0a1f17",
  border: "#35855E",
  borderActive: "#51A077",
  active: "#87D7AA",
  main: "#00a86b",
  onMain: "#ffffff",
  text: "#A2F4C5",
  textActive: "#BFFFD8",
};

const red: ColorValueType = {
  bg: "#330a0b",
  bgActive: "#4d0f11",
  bgSecondary: "#400d0f",
  bgSecondaryActive: "#330a0b",
  border: "#CF4940",
  borderActive: "#F16256",
  active: "#FF897E",
  main: "#fb2c36",
  onMain: "#ffffff",
  text: "#FFB4AB",
  textActive: "#FFDAD6",
};

const warning: ColorValueType = {
  bg: "#331f00",
  bgActive: "#4d2f00",
  bgSecondary: "#402800",
  bgSecondaryActive: "#331f00",
  border: "#CA8100",
  borderActive: "#EE9800",
  active: "#FFB95F",
  main: "#f59e0b",
  onMain: "#ffffff",
  text: "#FFDDB8",
  textActive: "#FFEEDE",
};

const defaultColor: ColorValueType = {
  bg: "#1f1f1f",
  bgActive: "#2c2c2c",
  bgSecondary: "#141414",
  bgSecondaryActive: "#1a1a1a",
  border: "#3a3a3a",
  borderActive: "#565656",
  active: "#6b6b6b",
  main: "#d1d5db",
  onMain: "#111827",
  text: "#d9d9d9",
  textActive: "#ffffff",
};

const grey: ColorValueType = {
  bg: "#1f2937",
  bgActive: "#374151",
  bgSecondary: "#111827",
  bgSecondaryActive: "#1f2937",
  border: "#4b5563",
  borderActive: "#6b7280",
  active: "#9ca3af",
  main: "#d1d5db",
  onMain: "#111827",
  text: "#e5e7eb",
  textActive: "#f9fafb",
};

// ─── Semantic map ─────────────────────────────────────────────────────────────

export const darkSemanticColors: SemanticColorMap = {
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

// ─── Flat token map ───────────────────────────────────────────────────────────

export const darkColorTokens = {
  colorPrimaryBg: "#1E1B4B",
  colorPrimaryBgHover: "#312E81",
  colorPrimaryBorder: "#4338CA",
  colorPrimaryBorderHover: "#4F46E5",
  colorPrimaryHover: "#818CF8",
  colorPrimary: "#818CF8",
  onColorPrimary: "#ffffff",
  colorPrimaryActive: "#A5B4FC",
  colorPrimaryTextHover: "#E0E7FF",
  colorPrimaryText: "#C7D2FE",
  colorPrimaryTextActive: "#E0E7FF",

  colorSuccessBg: "#162312",
  colorSuccessBgHover: "#1d3712",
  colorSuccessBorder: "#274916",
  colorSuccessBorderHover: "#306317",
  colorSuccessHover: "#306317",
  colorSuccess: "#49aa19",
  colorSuccessActive: "#3c8618",
  colorSuccessTextHover: "#6abe39",
  colorSuccessText: "#49aa19",
  colorSuccessTextActive: "#3c8618",

  colorWarningBg: warning.bg,
  colorWarningBgHover: "#443111",
  colorWarningBorder: "#594214",
  colorWarningBorderHover: "#7c5914",
  colorWarningHover: "#7c5914",
  colorWarning: "#d89614",
  colorWarningActive: "#aa7714",
  colorWarningTextHover: "#e8b339",
  colorWarningText: warning.main,
  colorWarningTextActive: "#aa7714",

  colorErrorBg: red.bg,
  colorErrorBgHover: "#451d1f",
  colorErrorBorder: "#5b2526",
  colorErrorBorderHover: "#7e2e2f",
  colorErrorHover: "#e86e6b",
  colorError: "#dc4446",
  colorErrorActive: "#ad393a",
  colorErrorTextHover: "#e86e6b",
  colorErrorText: "#dc4446",
  colorErrorTextActive: "#ad393a",

  colorInfoBg: "#111a2c",
  colorInfoBgHover: "#112545",
  colorInfoBorder: "#15325b",
  colorInfoBorderHover: "#15417e",
  colorInfoHover: "#15417e",
  colorInfo: "#1668dc",
  colorInfoActive: "#1554ad",
  colorInfoTextHover: "#3c89e8",
  colorInfoText: "#1668dc",
  colorInfoTextActive: "#1554ad",

  colorLinkHover: "#15417e",
  colorLinkActive: "#1554ad",

  colorText: "#E0E7FF",
  colorTextSecondary: "rgba(224, 231, 255, 0.65)",
  colorTextTertiary: "rgba(224, 231, 255, 0.45)",
  colorTextQuaternary: "rgba(224, 231, 255, 0.25)",

  colorBorder: "#3730A3",
  colorBorderSecondary: "#312E81",

  colorFill: "rgba(255, 255, 255, 0.18)",
  colorFillSecondary: "rgba(255, 255, 255, 0.12)",
  colorFillTertiary: "rgba(255, 255, 255, 0.08)",
  colorFillQuaternary: "rgba(255, 255, 255, 0.04)",

  colorBgContainer: "#1A1830",
  colorBgElevated: "#252340",
  colorBgLayout: "#0F0E17",
  colorBgSpotlight: "#312E81",
  colorBgMask: "#0F0E1773",

  colorWhite: "#ffffff",
  transparent: "transparent",
} as const;

// ─── Extended palette (full scale) ───────────────────────────────────────────

export const darkExtendedPalette = {
  colorBlue: blue.main,
  blueBg: "#012d58",
  colorGray: "#a0a0a0",
  colorOrange: orange.main,
  orangeBg: "#6c5702",
  colorViolet: violet.main,
  violetBg: "#1a0f33",
  colorGreen: green.main,
  greenBg: "#0a1f17",
  colorRed: red.main,
  redBg: "#480202",

  gradientLayoutBg:
    "linear-gradient(135deg, #1E1B4B 0%, #0F0E17 40%, #0F0E17 80%, #1E1B4B 100%)",

  blue1000: "#7BABFF",
  blue900: "#4A90F8",
  blue800: "#005CBA",
  blue700: "#0051A4",
  blue600: "#00458E",
  blue500: "#003A79",
  blue400: "#002F65",
  blue300: "#002551",
  blue200: "#001B3E",
  blue100: "#00102B",

  orange1000: "#EE9800",
  orange900: "#CA8100",
  orange800: "#855300",
  orange700: "#754900",
  orange600: "#653E00",
  orange500: "#563400",
  orange400: "#472A00",
  orange300: "#382100",
  orange200: "#2A1700",
  orange100: "#1C0E00",

  violet1000: "#B89BFF",
  violet900: "#A078FF",
  violet800: "#6D3BD7",
  violet700: "#612ACA",
  violet600: "#5516BE",
  violet500: "#4900AD",
  violet400: "#3C0091",
  violet300: "#2F0076",
  violet200: "#23005C",
  violet100: "#160041",

  red1000: "#FF897E",
  red900: "#F16256",
  red800: "#AD302A",
  red700: "#9D2420",
  red600: "#8C1716",
  red500: "#7B080C",
  red400: "#690005",
  red300: "#540003",
  red200: "#410002",
  red100: "#2D0001",

  green1000: "#6CBB90",
  green900: "#51A077",
  green800: "#146C47",
  green700: "#005F3C",
  green600: "#005233",
  green500: "#00452A",
  green400: "#003822",
  green300: "#002C1A",
  green200: "#002112",
  green100: "#00150A",
} as const;
