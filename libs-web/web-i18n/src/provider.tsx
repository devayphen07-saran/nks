import React, { ReactNode } from "react";
import { i18n as I18nType } from "i18next";
import { I18nextProvider } from "react-i18next";

export interface CustomI18nProviderProps {
  i18n: I18nType;
  children: ReactNode;
}

export function I18nProvider({ i18n, children }: CustomI18nProviderProps) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
