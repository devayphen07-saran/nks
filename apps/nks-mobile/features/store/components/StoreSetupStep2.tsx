import { UseFormReturn } from "react-hook-form";
import { Column, Input } from "@nks/mobile-ui-components";
import type { StoreFormValues } from "../hooks/useStoreSetupForm";
import { FormCard } from "./store-step-styles";

interface Props {
  form: UseFormReturn<StoreFormValues>;
}

export function StoreSetupStep2({ form }: Props) {
  const { control } = form;

  return (
    <FormCard>
      <Column gap="large">
        <Input
          name="registrationNumber"
          control={control}
          label="Registration Number (Optional)"
          placeholder="REG-123456"
        />

        <Input
          name="taxNumber"
          control={control}
          label="Tax Number / GST (Optional)"
          placeholder="GSTIN123456"
        />
      </Column>
    </FormCard>
  );
}
