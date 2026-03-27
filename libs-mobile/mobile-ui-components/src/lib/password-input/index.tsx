import React, { useState } from "react";
import { TextInputProps, TouchableOpacity } from "react-native";
import styled from "styled-components/native";
import {
  Controller,
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from "react-hook-form";
import { inputLabelStyles, inputStyles } from "../input/style";
import { Typography } from "../typography";
import { useMobileTheme } from "@nks/mobile-theme";
import { Eye, EyeOff } from "lucide-react-native";

interface PasswordInputProps<T extends FieldValues> extends Omit<
  TextInputProps,
  "defaultValue"
> {
  name: Path<T>;
  control: Control<T>;
  label?: string;
  rules?: RegisterOptions<T, Path<T>>;
  disabled?: boolean;
  required?: boolean;
}

export function PasswordInput<T extends FieldValues>({
  name,
  control,
  label,
  rules,
  disabled = false,
  required = false,
  ...rest
}: PasswordInputProps<T>) {
  const [secure, setSecure] = useState(true);
  const { theme } = useMobileTheme();
  const resolvedEditable = rest.editable ?? !disabled;
  const placeholderColor = theme.color?.grey?.text || "#9ca3af";

  return (
    <Controller
      control={control}
      name={name}
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
                {required && <RequiredMark> *</RequiredMark>}
              </Label>
            )}

            <InputRow>
              <StyledInput
                value={displayValue}
                onChangeText={handleChange}
                onBlur={onBlur}
                secureTextEntry={secure}
                placeholderTextColor={placeholderColor}
                editable={resolvedEditable}
                hasError={!!fieldError}
                disabled={disabled}
                autoCapitalize="none"
                autoCorrect={false}
                {...rest}
              />
              <ToggleButton
                onPress={() => setSecure(!secure)}
                disabled={disabled}
                activeOpacity={0.7}
              >
                {secure ? (
                  <Eye
                    size={20}
                    color={theme.colorTextSecondary || "#6B7280"}
                  />
                ) : (
                  <EyeOff
                    size={20}
                    color={theme.colorTextSecondary || "#6B7280"}
                  />
                )}
              </ToggleButton>
            </InputRow>

            {fieldError?.message && <ErrorText>{fieldError.message}</ErrorText>}
          </Wrapper>
        );
      }}
    />
  );
}

const Wrapper = styled.View`
  width: 100%;
  margin-bottom: ${({ theme }) => theme.margin.medium}px;
`;

const Label = styled(Typography.Body)`
  ${({ theme }) => {
    const s = inputLabelStyles(theme);
    return `
      font-size: ${String(s.fontSize)}px;
      font-weight: ${String(s.fontWeight)};
      margin-bottom: ${String(theme.margin.xSmall)}px;
      color: ${String(s.color)};
      font-family: ${String(s.fontFamily)};
    `;
  }}
`;

const RequiredMark = styled(Typography.Body)`
  color: ${({ theme }) => theme.colorError};
`;

const InputRow = styled.View`
  position: relative;
  flex-direction: row;
  align-items: center;
  width: 100%;
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
  flex: 1;
  padding-right: ${({ theme }) => theme.padding.xxLarge}px;
  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
`;

const ToggleButton = styled(TouchableOpacity)<{ disabled?: boolean }>`
  position: absolute;
  right: ${({ theme }) => theme.padding.medium}px;
  padding: ${({ theme }) => theme.padding.xxSmall}px;
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
`;

const ErrorText = styled(Typography.Caption)`
  margin-top: ${({ theme }) => theme.margin.xxSmall}px;
  color: ${({ theme }) => theme.colorError};
`;
