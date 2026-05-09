import { useCallback } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { Column, Input, Row } from "@nks/mobile-ui-components";
import { View } from "react-native";
import type { StoreFormValues } from "../hooks/useStoreSetupForm";
import { StateSelect, DistrictSelect } from "../../../components/selects";
import type { StateSelectItem, DistrictSelectItem } from "../../../lib/hooks";

interface Props {
  form: UseFormReturn<StoreFormValues>;
}

export function StoreSetupStep3({ form }: Props) {
  const { control, setValue } = form;
  const selectedStateGuuid    = useWatch({ control, name: "stateGuuid" });
  const selectedDistrictGuuid = useWatch({ control, name: "districtGuuid" });

  const handleStateChange = useCallback(
    (item: StateSelectItem | undefined) => {
      setValue("stateGuuid", item?.guuid ?? "", { shouldValidate: true });
      setValue("districtGuuid", "");
    },
    [setValue],
  );

  const handleDistrictChange = useCallback(
    (item: DistrictSelectItem | undefined) => {
      setValue("districtGuuid", item?.guuid ?? "");
    },
    [setValue],
  );

  return (
    <Column gap="medium">
      <Input
        name="addressLine1"
        control={control}
        label="Address line 1"
        placeholder="Street address"
        required
      />

      <Input
        name="addressLine2"
        control={control}
        label="Address line 2"
        placeholder="Apartment, suite, etc."
      />

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

      <StateSelect
        mode="online"
        required
        value={selectedStateGuuid}
        onChange={handleStateChange}
      />

      <DistrictSelect
        mode="online"
        stateGuuid={selectedStateGuuid}
        value={selectedDistrictGuuid}
        onChange={handleDistrictChange}
      />
    </Column>
  );
}
