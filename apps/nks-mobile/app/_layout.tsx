import * as SplashScreen from "expo-splash-screen";
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
SplashScreen.preventAutoHideAsync().catch(() => {});
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
