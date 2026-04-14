import { Controller, UseFormReturn } from "react-hook-form";
import { Column } from "@nks/mobile-ui-components";
import { Input } from "@nks/mobile-ui-components";
import { StoreLegalTypeSelect, StoreCategorySelect } from "../../../components/selects";
import type { StoreFormValues } from "../hooks/useStoreSetupForm";
import { FormCard } from "./store-step-styles";

interface Props {
  form: UseFormReturn<StoreFormValues>;
}

export function StoreSetupStep1({ form }: Props) {
  const { control, formState: { errors } } = form;

  return (
    <FormCard>
      <Column gap="large">
        <Input
          name="storeName"
          control={control}
          label="Store Name"
          placeholder="My Awesome Shop"
          required
        />

        <Input
          name="storeCode"
          control={control}
          label="Store Code (Optional)"
          placeholder="SHOP001"
        />

        <Controller
          name="storeLegalTypeCode"
          control={control}
          render={({ field: { onChange, value } }) => (
            <StoreLegalTypeSelect
              required
              value={value}
              onChange={onChange}
              errorMessage={errors.storeLegalTypeCode?.message}
            />
          )}
        />

        <Controller
          name="storeCategoryCode"
          control={control}
          render={({ field: { onChange, value } }) => (
            <StoreCategorySelect
              required
              value={value}
              onChange={onChange}
              errorMessage={errors.storeCategoryCode?.message}
            />
          )}
        />
      </Column>
    </FormCard>
  );
}
