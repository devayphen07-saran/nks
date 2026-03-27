import {
  useTranslation as useTransitionFromI18Next,
  UseTranslationOptions,
} from "react-i18next";

export const useTranslation = (
  ns?: undefined,
  options?: UseTranslationOptions<string> | undefined
) => {
  const { t, i18n } = useTransitionFromI18Next(ns, options);
  const translation = i18n.t;
  return { t, i18n, translation };
};
