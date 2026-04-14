import { UseFormReturn } from "react-hook-form";
import { Column, Input, Row } from "@nks/mobile-ui-components";
import { View } from "react-native";
import type { StoreFormValues } from "../hooks/useStoreSetupForm";
import { FormCard } from "./store-step-styles";

interface Props {
  form: UseFormReturn<StoreFormValues>;
}

export function StoreSetupStep3({ form }: Props) {
  const { control } = form;

  return (
    <FormCard>
      <Column gap="large">
        <Input
          name="addressLine1"
          control={control}
          label="Address Line 1"
          placeholder="Street address"
          required
        />

        <Input
          name="addressLine2"
          control={control}
          label="Address Line 2 (Optional)"
          placeholder="Apartment, suite, etc."
        />

        <Row gap="medium">
          <View style={{ flex: 1 }}>
            <Input
              name="city"
              control={control}
              label="City / Town"
              placeholder="Your city"
              required
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              name="pincode"
              control={control}
              label="Pincode"
              placeholder="6-digit PIN"
              keyboardType="number-pad"
              maxLength={6}
              required
            />
          </View>
        </Row>

        {/* TODO: Replace with State/District select dropdowns
            using backend location API:
            GET /location/states/list → state picker
            GET /location/states/:stateId/districts → district picker */}
      </Column>
    </FormCard>
  );
}
