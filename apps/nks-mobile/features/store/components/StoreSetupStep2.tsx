import { UseFormReturn } from "react-hook-form";
import { Column, Input } from "@nks/mobile-ui-components";
import styled from "styled-components/native";
import type { StoreFormValues } from "../hooks/useStoreSetupForm";

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

const FormCard = styled.View`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
  padding: ${({ theme }) => theme.sizing.large}px;
  margin-bottom: ${({ theme }) => theme.sizing.medium}px;
`;
