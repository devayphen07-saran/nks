import React from "react";
import styled from "styled-components/native";
import { Controller, Control, FieldValues, Path } from "react-hook-form";
import { Typography } from "../typography";
import { useMobileTheme } from "@nks/mobile-theme";

interface Option {
  label: string;
  value: string;
}

interface RadioGroupProps<T extends FieldValues = any> {
  options: Option[];
  value?: string;
  onChange?: (val: string) => void;
  label?: string;
  name?: Path<T>;
  control?: Control<T>;
  errorMessage?: string;
  disabled?: boolean;
}

export function RadioGroup<T extends FieldValues = any>({
  options,
  value,
  onChange,
  label,
  name,
  control,
  errorMessage,
  disabled = false,
}: RadioGroupProps<T>) {
  const { theme } = useMobileTheme();

  const renderGroup = (val: string | undefined, change: (val: string) => void) => (
    <Container disabled={disabled}>
      {label && (
        <Typography.Body
          style={{
            color: disabled ? theme.color?.default?.text : theme.colorText,
          }}
        >
          {label}
        </Typography.Body>
      )}

      <OptionsWrapper>
        {options.map((opt) => {
          const selected = val === opt.value;
          return (
            <OptionTouchable
              key={opt.value}
              onPress={() => !disabled && change(opt.value)}
              disabled={disabled}
              style={{ opacity: disabled ? 0.5 : 1 }}
            >
              <OuterCircle selected={selected} disabled={disabled}>
                {selected && <InnerCircle disabled={disabled} />}
              </OuterCircle>
              <Typography.Body style={{ marginLeft: 8 }}>{opt.label}</Typography.Body>
            </OptionTouchable>
          );
        })}
      </OptionsWrapper>

      {errorMessage && (
        <Typography.Caption style={{ color: theme.color?.red?.main }}>
          {errorMessage}
        </Typography.Caption>
      )}
    </Container>
  );

  if (name && control) {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field: { value, onChange } }) => renderGroup(value, onChange)}
      />
    );
  }

  return renderGroup(
    value,
    onChange ||
      (() => {
        /* empty */
      })
  );
}

const OptionsWrapper = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  margin-top: 6px;
  gap: 10px;
`;

const OptionTouchable = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  margin-bottom: 12px;
`;

const Container = styled.View<{ disabled?: boolean }>`
  margin-top: 8px;
  margin-bottom: 8px;
  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
`;

const OuterCircle = styled.View<{ selected: boolean; disabled?: boolean }>`
  width: 22px;
  height: 22px;
  border-radius: 11px;
  border-width: 2px;
  border-color: ${({ disabled, selected, theme }) =>
    disabled ? theme.colorBorder : selected ? theme.colorPrimary : theme.colorBorder};
  align-items: center;
  justify-content: center;
`;

const InnerCircle = styled.View<{ disabled?: boolean }>`
  width: 12px;
  height: 12px;
  border-radius: 6px;
  background-color: ${({ disabled, theme }) => (disabled ? theme.colorBorder : theme.colorPrimary)};
`;
