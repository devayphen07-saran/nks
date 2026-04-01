import * as SplashScreen from "expo-splash-screen";
import { Slot } from "expo-router";
import { Provider as ReduxProvider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MobileThemeProvider } from "@nks/mobile-theme";
import { I18nProvider, i18nInstance } from "@nks/mobile-i18n";
import { store } from "../store";
import { AuthProvider } from "../utils/auth-provider";
import { LoadingFallback } from "../components/feedback/LoadingFallback";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

SplashScreen.preventAutoHideAsync().catch(() => {});
const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <I18nProvider i18n={i18nInstance}>
            <SafeAreaProvider>
              <MobileThemeProvider loadingFallback={<LoadingFallback />}>
                <AuthProvider>
                  <Slot />
                </AuthProvider>
              </MobileThemeProvider>
            </SafeAreaProvider>
          </I18nProvider>
        </QueryClientProvider>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}
