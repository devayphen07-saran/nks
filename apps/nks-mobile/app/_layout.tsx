import * as SplashScreen from "expo-splash-screen";
import { Slot } from "expo-router";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MobileThemeProvider } from "@nks/mobile-theme";
import { I18nProvider, i18nInstance } from "@nks/mobile-i18n";
import { store } from "../store";
import { AuthProvider } from "../utils/auth-provider";
import { LoadingFallback } from "../components/feedback/LoadingFallback";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <Provider store={store}>
      <I18nProvider i18n={i18nInstance}>
        <SafeAreaProvider>
          <MobileThemeProvider loadingFallback={<LoadingFallback />}>
            <AuthProvider>
              <Slot />
            </AuthProvider>
          </MobileThemeProvider>
        </SafeAreaProvider>
      </I18nProvider>
    </Provider>
  );
}
