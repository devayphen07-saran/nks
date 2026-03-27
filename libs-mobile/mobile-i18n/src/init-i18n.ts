import i18n, { i18n as I18nType } from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { resources, defaultNS } from "@nks/common-i18n";

const STORE_LANGUAGE_KEY = "settings.lang";

const languageDetector: any = {
  type: "languageDetector",
  async: true,
  init: () => {},
  detect: async (callback: (lng: string) => void) => {
    try {
      const savedDataJSON = await AsyncStorage.getItem(STORE_LANGUAGE_KEY);
      if (savedDataJSON) {
        return callback(savedDataJSON);
      }
    } catch (error) {
      console.log("Error reading language from AsyncStorage", error);
    }
    const locales = getLocales();
    if (locales && locales.length > 0) {
      const bestLocale = locales[0].languageCode;
      if (bestLocale) {
        return callback(bestLocale);
      }
    }
    callback("en");
  },
  cacheUserLanguage: async (lng: string) => {
    try {
      await AsyncStorage.setItem(STORE_LANGUAGE_KEY, lng);
    } catch (error) {
      console.log("Error caching language in AsyncStorage", error);
    }
  },
};

export const i18nInstance: I18nType = i18n.createInstance();

i18nInstance
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    defaultNS,
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: "v4",
  });

export const changeLanguage = async (lng: string) => {
  await i18nInstance.changeLanguage(lng);
};

export default i18nInstance;
