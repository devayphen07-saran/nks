import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Appearance, type ColorSchemeName, StatusBar } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider as StyledThemeProvider } from "styled-components/native";
import { mobileThemeTokens, type NKSTheme } from "./tokens";
import type { ColorVariantKey } from "./tokens/colors/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const THEME_STORAGE_KEY = "@nks_mobile_theme";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ColorPlace = "background" | "main" | "border";

export interface MobileThemeContextType {
  /** Whether the active theme is dark. */
  isDarkMode: boolean;
  /** OS-level color scheme (may differ if user overrode it manually). */
  colorScheme: ColorSchemeName;
  /** `false` until the persisted preference has been read — prevents flash-of-wrong-theme. */
  isThemeReady: boolean;
  /** Toggle between light/dark and persist the choice. */
  toggleTheme: () => Promise<void>;
  /** Set a specific mode and persist the choice. */
  setTheme: (isDark: boolean) => Promise<void>;
  /** Fully resolved token object for the current mode. */
  theme: NKSTheme;
}

export interface MobileThemeProviderProps {
  children: ReactNode;
  /**
   * Rendered instead of `children` while the persisted preference is loading.
   * Useful for keeping a native splash screen up. Defaults to `null`.
   */
  loadingFallback?: ReactNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function persistTheme(isDark: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(isDark));
  } catch (err) {
    if (__DEV__) console.warn("[NKSTheme] Failed to persist preference:", err);
  }
}

async function loadPersistedTheme(): Promise<boolean | null> {
  try {
    const raw = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "boolean" ? parsed : null;
  } catch (err) {
    if (__DEV__) console.warn("[NKSTheme] Failed to load preference:", err);
    return null;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const MobileThemeContext = createContext<
  MobileThemeContextType | undefined
>(undefined);
MobileThemeContext.displayName = "NKSMobileThemeContext";

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MobileThemeProvider({
  children,
  loadingFallback = null,
}: MobileThemeProviderProps) {
  const systemScheme = Appearance.getColorScheme();

  const [colorScheme, setColorScheme] = useState<ColorSchemeName>(systemScheme);
  const [isDarkMode, setIsDarkModeState] = useState<boolean>(
    systemScheme === "dark",
  );
  const [isThemeReady, setIsThemeReady] = useState<boolean>(false);

  // Tracks whether an explicit user preference exists so the OS listener
  // never silently overrides a manual choice.
  const hasUserPreference = useRef<boolean>(false);

  // ── Hydrate on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const saved = await loadPersistedTheme();
      if (cancelled) return;

      if (saved !== null) {
        hasUserPreference.current = true;
        setIsDarkModeState(saved);
      } else {
        const systemDark = Appearance.getColorScheme() === "dark";
        setIsDarkModeState(systemDark);
        await persistTheme(systemDark);
      }

      setIsThemeReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Follow OS appearance changes ────────────────────────────────────────────
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme: next }) => {
      setColorScheme(next);
      if (!hasUserPreference.current) {
        setIsDarkModeState(next === "dark");
      }
    });
    return () => sub.remove();
  }, []);

  // ── Stable action callbacks ─────────────────────────────────────────────────
  const toggleTheme = useCallback(async () => {
    setIsDarkModeState((prev) => {
      const next = !prev;
      hasUserPreference.current = true;
      void persistTheme(next);
      return next;
    });
  }, []);

  const setTheme = useCallback(async (isDark: boolean) => {
    hasUserPreference.current = true;
    setIsDarkModeState(isDark);
    await persistTheme(isDark);
  }, []);

  // ── Resolved tokens ─────────────────────────────────────────────────────────
  const theme = useMemo<NKSTheme>(
    () => (isDarkMode ? mobileThemeTokens.dark : mobileThemeTokens.light),
    [isDarkMode],
  );

  // ── Context value ───────────────────────────────────────────────────────────
  const contextValue = useMemo<MobileThemeContextType>(
    () => ({
      isDarkMode,
      colorScheme,
      isThemeReady,
      toggleTheme,
      setTheme,
      theme,
    }),
    [isDarkMode, colorScheme, isThemeReady, toggleTheme, setTheme, theme],
  );

  return (
    <MobileThemeContext.Provider value={contextValue}>
      <StyledThemeProvider theme={theme}>
        <StatusBar
          barStyle={isDarkMode ? "light-content" : "dark-content"}
          backgroundColor={theme.colorBgLayout}
          translucent={false}
        />
        {isThemeReady ? children : loadingFallback}
      </StyledThemeProvider>
    </MobileThemeContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Access the current theme context.
 * @throws if called outside of `<MobileThemeProvider>`.
 */
export function useMobileTheme(): MobileThemeContextType {
  const ctx = useContext(MobileThemeContext);
  if (!ctx) {
    throw new Error(
      "[useMobileTheme] Must be used inside <MobileThemeProvider>.",
    );
  }
  return ctx;
}

/**
 * Returns memoised color values for a given semantic `place`.
 *
 * @example
 * const bg = useColorVariant({ place: "background" });
 * <View style={{ backgroundColor: bg.primary }} />
 */
export function useColorVariant({
  place,
}: {
  place: ColorPlace;
}): Record<ColorVariantKey, string> {
  const { theme } = useMobileTheme();

  return useMemo<Record<ColorVariantKey, string>>(() => {
    switch (place) {
      case "background":
        return {
          primary: theme.colorPrimaryBg,
          secondary: theme.colorFillSecondary ?? theme.colorBgContainer,
          danger: theme.colorErrorBg,
          success: theme.colorSuccessBg,
          warning: theme.colorWarningBg,
          orange: theme.orange300,
          green: theme.green300,
          blue: theme.blue300,
          violet: theme.violet300,
          red: theme.red300,
          grey:
            theme.colorGray ??
            theme.colorTextSecondary ??
            theme.colorBgContainer,
          default: theme.colorBgContainer,
        };
      case "border":
        return {
          primary: theme.colorPrimaryBorder,
          secondary: theme.colorBorderSecondary ?? theme.colorBorder,
          danger: theme.colorErrorBorder,
          success: theme.colorSuccessBorder,
          warning: theme.colorWarningBorder,
          orange: theme.orange600,
          green: theme.green600,
          blue: theme.blue600,
          violet: theme.violet600,
          red: theme.red600,
          grey: theme.colorGray ?? theme.colorBorder,
          default: theme.colorBorder,
        };
      case "main":
      default:
        return {
          primary: theme.colorPrimary,
          secondary: theme.colorTextSecondary ?? theme.colorText,
          danger: theme.colorError,
          success: theme.colorSuccess,
          warning: theme.colorWarning,
          orange: theme.colorOrange,
          green: theme.colorGreen,
          blue: theme.colorBlue,
          violet: theme.colorViolet,
          red: theme.colorRed,
          grey: theme.colorGray ?? theme.colorTextSecondary,
          default: theme.colorText,
        };
    }
  }, [theme, place]);
}

export default MobileThemeProvider;
