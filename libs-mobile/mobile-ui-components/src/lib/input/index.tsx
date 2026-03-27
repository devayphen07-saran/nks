import React from "react";
import { TextInputProps } from "react-native";
import styled from "styled-components/native";
import {
  Controller,
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from "react-hook-form";
import { inputLabelStyles, inputStyles } from "./style";
import { Typography } from "../typography";
import { useMobileTheme } from "@nks/mobile-theme";

interface FormInputProps<T extends FieldValues> extends TextInputProps {
  name: Path<T>;
  control: Control<T>;
  label?: string;
  rules?: RegisterOptions<T, Path<T>>;
  inputDataType?: InputDataType;
  disabled?: boolean;
  required?: boolean;
  prefix?: React.ReactNode;
}

type InputDataType = "email" | "phoneNumber" | "text" | "number";

const InputValueTypes: Record<InputDataType, Partial<TextInputProps>> = {
  email: { keyboardType: "email-address", autoCapitalize: "none" },
  phoneNumber: { keyboardType: "phone-pad", autoCapitalize: "none" },
  text: { keyboardType: "default", autoCapitalize: "sentences" },
  number: { keyboardType: "numeric", autoCapitalize: "none" },
};

export function Input<T extends FieldValues>({
  name,
  control,
  label,
  rules,
  inputDataType = "text",
  disabled = false,
  required = false,
  prefix,
  editable,
  ...rest
}: FormInputProps<T>) {
  const { theme } = useMobileTheme();

  const resolvedEditable = editable ?? !disabled;
  const placeholderColor = theme.color?.grey?.text || "#9ca3af";
  const typeProps = InputValueTypes[inputDataType];

  const sanitizeValue = (text: string) =>
    inputDataType === "number" ? text.replace(/[^0-9.]/g, "") : text;

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({
        field: { onChange: handleChange, onBlur, value: val },
        fieldState: { error: fieldError },
      }: {
        field: { value: any; onChange: (v: any) => void; onBlur: () => void };
        fieldState: { error?: { message?: string } };
      }) => {
        const displayValue = String(val ?? "");

        return (
          <Wrapper>
            {label && (
              <Label>
                {label}
                {required && <RequiredMark>{" *"}</RequiredMark>}
              </Label>
            )}

            {prefix ? (
              <PrefixContainer hasError={!!fieldError} disabled={disabled}>
                {prefix}
                <TransparentInput
                  value={displayValue}
                  editable={resolvedEditable}
                  placeholderTextColor={placeholderColor}
                  {...typeProps}
                  {...rest}
                  onChangeText={(text) => handleChange(sanitizeValue(text))}
                  onBlur={onBlur}
                />
              </PrefixContainer>
            ) : (
              <StyledInput
                value={displayValue}
                editable={resolvedEditable}
                placeholderTextColor={placeholderColor}
                hasError={!!fieldError}
                disabled={disabled}
                {...typeProps}
                {...rest}
                onChangeText={(text) => handleChange(sanitizeValue(text))}
                onBlur={onBlur}
              />
            )}

            {fieldError?.message && <ErrorText>{fieldError.message}</ErrorText>}
          </Wrapper>
        );
      }}
    />
  );
}

export default Input;
const Wrapper = styled.View`
  width: 100%;
`;

const Label = styled(Typography.Caption)`
  ${({ theme }) => {
    const s = inputLabelStyles(theme);
    return `
      font-size: ${String(s.fontSize)}px;
      font-weight: ${String(s.fontWeight)};
      margin-bottom: ${String(s.marginBottom)}px;
      color: ${String(s.color)};
      font-family: ${String(s.fontFamily)};
    `;
  }}
  padding-bottom: 4px;
  margin-left: 3px;
`;

const RequiredMark = styled(Typography.Body)`
  color: ${({ theme }) => theme.color?.red?.main || "#dc2626"};
`;

const StyledInput = styled.TextInput<{
  hasError?: boolean;
  disabled?: boolean;
}>`
  ${({ theme, hasError }) => {
    const s = inputStyles(theme, hasError);
    return `
      border-width: ${String(s.borderWidth)}px;
      border-color: ${String(s.borderColor)};
      border-radius: ${String(s.borderRadius)}px;
      padding: ${String(s.padding)}px;
      font-size: ${String(s.fontSize)}px;
      font-family: ${String(s.fontFamily)};
      color: ${String(s.color)};
    `;
  }}
  width: 100%;
  margin-bottom: 13px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
`;

const PrefixContainer = styled.View<{
  hasError?: boolean;
  disabled?: boolean;
}>`
  ${({ theme, hasError }) => {
    const s = inputStyles(theme, hasError);
    return `
      border-width: ${String(s.borderWidth)}px;
      border-color: ${String(s.borderColor)};
      border-radius: ${String(s.borderRadius)}px;
      padding: ${String(s.padding)}px;
    `;
  }}
  flex-direction: row;
  align-items: center;
  column-gap: 8px;
  padding-left: 12px;
  margin-bottom: 13px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
`;

const TransparentInput = styled.TextInput`
  flex: 1;
  font-family: ${({ theme }) => theme.fontFamily.poppinsRegular};
  font-size: ${({ theme }) => theme.fontSize.small}px;
  color: ${({ theme }) => theme.colorText};
`;

const ErrorText = styled(Typography.Caption)`
  color: ${({ theme }) => theme.color?.red?.main || "#dc2626"};
  margin-left: 3px;
`;
