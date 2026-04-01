import React from "react";
import { useSelector } from "react-redux";
import {
  SelectGeneric,
  ConfigSelectItem,
  Typography,
} from "@nks/mobile-ui-components";
import { useConfig } from "../../store";

interface Country {
  id: number;
  name: string;
}

interface Props {
  value?: number;
  onChange: (value?: number) => void;
  label?: string;
  required?: boolean;
  errorMessage?: string;
}

export const CountrySelect = ({
  value,
  onChange,
  label = "Country",
  required,
  errorMessage,
}: Props) => {
  const {
    countries: {
      response: countries,
      isLoading: countriesLoading,
      errors: countryErrors,
    },
  } = useConfig();

  return (
    <SelectGeneric<Country>
      label={label}
      required={required}
      options={countries}
      value={value}
      valueKey="id"
      onChange={(item) => onChange(item?.id)}
      loading={countriesLoading}
      noDataMessage="No countries found"
      errorMessage={errorMessage}
      displayRenderer={(selected) => (
        <Typography.Body>
          {selected ? selected.name : "Select Country..."}
        </Typography.Body>
      )}
      renderItem={(item, onSelect, isSelected) => (
        <ConfigSelectItem
          title={item.name}
          isSelected={isSelected}
          disabled={false}
          onPress={() => onSelect(item)}
        />
      )}
    />
  );
};
