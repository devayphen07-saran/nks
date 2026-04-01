// libs-common/shared-types/src/lib/types/config-master.ts

export interface ConfigMaster {
  id: number;
  categoryName: string;
  configName: string;
  code: string;
  value?: string;
  sortOrder?: number;
}

export interface ApplicationModel {
  id: number;
  applicationName: string;
  applicationCode: string;
  applicationDescription?: string;
}

export interface CountryModel {
  id: number;
  countryName: string;
  code: string;
  phoneCode: string;
  phoneCodeId: number;
  regions?: any[];
  countryInfo?: any[];
  label?: string; // For compatibility with select components
  value?: number; // For compatibility with select components
}

export interface CurrencyModel {
  id: number;
  currencyName: string;
  currencyCode: string;
  currencySymbol: string;
}

export interface PhoneCodeList {
  value: number;
  label: string;
  phoneCode: string;
  isoCode: string;
}

export interface AppCatalog {
  [key: string]: any;
}
