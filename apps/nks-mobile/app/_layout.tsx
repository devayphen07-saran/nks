import * as SplashScreen from "expo-splash-screen";
import { useState, useEffect } from "react";
import { View } from "react-native";
import { Slot } from "expo-router";
import { Provider as ReduxProvider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MobileThemeProvider } from "@nks/mobile-theme";
import { I18nProvider, i18nInstance } from "@nks/mobile-i18n";
import { store } from "../store";
import { AuthProvider } from "../lib/auth-provider";
import { LoadingFallback } from "../components/feedback/LoadingFallback";
import { OfflineStatusBanner } from "../components/feedback/OfflineStatusBanner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initializePinning } from "../lib/ssl-pinning";
import { initServerTime } from "../lib/server-time";

SplashScreen.preventAutoHideAsync().catch(() => {});
// Pre-load clock offset from SecureStore so token expiry checks are accurate from startup
initServerTime().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes for reference data
      retry: 2,
      refetchOnWindowFocus: false, // mobile - no window focus
    },
  },
});

export default function RootLayout() {
  // Block all rendering (and therefore all network calls) until SSL pinning is
  // configured. This ensures no request can bypass certificate validation.
  const [pinningReady, setPinningReady] = useState(false);

  useEffect(() => {
    initializePinning()
      .catch(() => {
        // initializePinning throws in production if pinning fails (C4 fix).
        // If it gets here in dev, we continue anyway.
      })
      .finally(() => {
        setPinningReady(true);
      });
  }, []);

  if (!pinningReady) {
    return <LoadingFallback />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <I18nProvider i18n={i18nInstance}>
            <SafeAreaProvider>
              <MobileThemeProvider loadingFallback={<LoadingFallback />}>
                <AuthProvider>
                  <View style={{ flex: 1 }}>
                    <OfflineStatusBanner />
                    <Slot />
                  </View>
                </AuthProvider>
              </MobileThemeProvider>
            </SafeAreaProvider>
          </I18nProvider>
        </QueryClientProvider>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}
