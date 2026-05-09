import { UseFormReturn } from "react-hook-form";
import { Column, Input } from "@nks/mobile-ui-components";
import type { StoreFormValues } from "../hooks/useStoreSetupForm";

interface Props {
  form: UseFormReturn<StoreFormValues>;
}

export function StoreSetupStep2({ form }: Props) {
  const { control } = form;

  return (
    <Column gap="medium">
      <Input
        name="registrationNumber"
        control={control}
        label="Registration number"
        placeholder="REG-123456"
      />

      <Input
        name="taxNumber"
        control={control}
        label="Tax / GST number"
        placeholder="GSTIN123456"
      />
    </Column>
  );
}
