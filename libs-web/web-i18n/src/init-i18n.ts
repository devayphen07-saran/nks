import i18n, { i18n as I18nType } from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { resources, defaultNS } from "@nks/common-i18n";

export const i18nInstance: I18nType = i18n.createInstance();

i18nInstance
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    defaultNS,
    interpolation: {
      escapeValue: false, 
    },
    detection: {
      order: ["localStorage", "cookie", "navigator", "htmlTag"],
      caches: ["localStorage", "cookie"], 
    },
  });

export const changeLanguage = async (lng: string) => {
  await i18nInstance.changeLanguage(lng);
};

export default i18nInstance;
