import { Controller, UseFormReturn } from "react-hook-form";
import { Column, Input, Row } from "@nks/mobile-ui-components";
import { View } from "react-native";
import styled from "styled-components/native";
import { CountrySelect } from "../../../components/selects";
import type { StoreFormValues } from "../hooks/useStoreSetupForm";

interface Props {
  form: UseFormReturn<StoreFormValues>;
}

export function StoreSetupStep3({ form }: Props) {
  const { control, formState: { errors } } = form;

  return (
    <FormCard>
      <Column gap="large">
        <Controller
          name="countryFk"
          control={control}
          render={({ field: { onChange, value } }) => (
            <CountrySelect
              required
              value={value}
              onChange={onChange}
              errorMessage={errors.countryFk?.message}
            />
          )}
        />

        <Input
          name="addressLine1"
          control={control}
          label="Address Line 1"
          placeholder="Street address"
          required
        />

        <Row gap="medium">
          <View style={{ flex: 1 }}>
            <Input
              name="addressLine2"
              control={control}
              label="Address Line 2 (Optional)"
              placeholder="Apartment, suite, etc."
            />
          </View>
        </Row>

        <Row gap="medium">
          <View style={{ flex: 1 }}>
            <Input
              name="city"
              control={control}
              label="City"
              placeholder="Your city"
              required
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              name="postalCode"
              control={control}
              label="Postal Code"
              placeholder="ZIP"
              required
            />
          </View>
        </Row>

        <Row gap="medium">
          <View style={{ flex: 1 }}>
            <Input
              name="stateRegionProvinceText"
              control={control}
              label="State/Region (Optional)"
              placeholder="State name"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              name="districtText"
              control={control}
              label="District (Optional)"
              placeholder="District"
            />
          </View>
        </Row>
      </Column>
    </FormCard>
  );
}

const FormCard = styled.View`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
  padding: ${({ theme }) => theme.sizing.large}px;
  margin-bottom: ${({ theme }) => theme.sizing.medium}px;
`;
