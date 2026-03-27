import React, { useState } from "react";
import { TextInputProps } from "react-native";
import styled from "styled-components/native";
import {
  Controller,
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from "react-hook-form";
import { Typography } from "../typography";
import { inputStyles } from "../input/style";
import { useMobileTheme } from "@nks/mobile-theme";

interface TextAreaProps<T extends FieldValues = any> extends Omit<
  TextInputProps,
  "onChange" | "value"
> {
  value?: string;
  onChange?: (value: string) => void;
  name?: Path<T>;
  control?: Control<T>;
  rules?: RegisterOptions<T, Path<T>>;
  style?: any;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  height?: number;
}

export function TextArea<T extends FieldValues = any>({
  value,
  onChange,
  name,
  control,
  rules,
  style,
  label,
  required,
  disabled = false,
  placeholder,
  height = 100,
  error,
  ...rest
}: TextAreaProps<T>) {
  const { theme } = useMobileTheme();
  const [isFocused, setIsFocused] = useState(false);

  const renderArea = (
    val: string,
    setVal: (v: string) => void,
    errorMsg?: string,
  ) => {
    const showPlaceholder = !val && !isFocused;

    return (
      <Wrapper style={[{ opacity: disabled ? 0.6 : 1 }, style]}>
        {label && (
          <Typography.Caption style={{ paddingBottom: 4, marginLeft: 3 }}>
            {label}
            {required && (
              <Typography.Body
                type="secondary"
                style={{ color: theme.color?.red?.main || theme.colorError }}
              >
                {" *"}
              </Typography.Body>
            )}
          </Typography.Caption>
        )}

        <Container>
          <StyledTextArea
            value={val}
            onChangeText={setVal}
            editable={!disabled}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            hasError={!!errorMsg}
            height={height}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...rest}
          />

          {showPlaceholder && placeholder && (
            <CustomPlaceholder pointerEvents="none">
              <Typography.Caption
                style={{ color: theme.color?.grey?.active || "#9ca3af" }}
              >
                {placeholder}
              </Typography.Caption>
            </CustomPlaceholder>
          )}
        </Container>

        {errorMsg && (
          <Typography.Caption
            type="secondary"
            style={{
              color: theme.color?.red?.main || theme.colorError,
              marginLeft: 3,
            }}
          >
            * {errorMsg}
          </Typography.Caption>
        )}
      </Wrapper>
    );
  };

  /* ---------------- Controlled ---------------- */
  if (name && control) {
    return (
      <Controller
        name={name}
        control={control}
        rules={rules}
        render={({
          field: { value: val, onChange: handleChange, onBlur },
          fieldState: { error: fieldError },
        }: {
          field: { value: any; onChange: (v: any) => void; onBlur: () => void };
          fieldState: { error?: { message?: string } };
        }) => renderArea(val ?? "", handleChange, fieldError?.message)}
      />
    );
  }

  /* ---------------- Uncontrolled ---------------- */
  return renderArea(value ?? "", onChange ?? (() => {}), error);
}

/* ---------------- Styled Components ---------------- */

const Wrapper = styled.View`
  width: 100%;
  margin-bottom: 13px;
`;

const Container = styled.View`
  position: relative;
`;

interface StyledTextAreaProps {
  height: number;
  hasError?: boolean;
}

const StyledTextArea = styled.TextInput<StyledTextAreaProps>`
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
  min-height: ${({ height }) => height}px;
  background-color: ${({ theme }) => theme.colorBgContainer || "#ffffff"};
  text-align-vertical: top;
`;

const CustomPlaceholder = styled.View`
  position: absolute;
  top: 12px;
  left: 16px;
  opacity: 0.7;
`;

export default TextArea;
