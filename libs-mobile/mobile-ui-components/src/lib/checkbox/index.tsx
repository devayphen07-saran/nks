import React, { useCallback } from "react";
import { Pressable, type PressableProps, type TextStyle, type ViewStyle } from "react-native";
import styled from "styled-components/native";
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
  type RegisterOptions,
} from "react-hook-form";
import { useMobileTheme } from "@nks/mobile-theme";

type CheckBoxVisualProps = {
  value: boolean;
  onValueChange?: (nextValue: boolean) => void;
  disabled?: boolean;
  size?: number;
  /**
   * Color for the checked state
   * @default theme.colorPrimary
   */
  color?: string;
  /**
   * Color for the unchecked state
   * @default 'transparent'
   */
  uncheckedColor?: string;
  /**
   * Border color
   * @default theme.colorBorder
   */
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  label?: string;
  /**
   * Position of the label relative to the checkbox
   * @default 'right'
   */
  labelPosition?: "left" | "right" | "top" | "bottom";
  labelStyle?: TextStyle;
  containerStyle?: ViewStyle;
  checkboxStyle?: ViewStyle;
};

type CheckBoxBaseProps = Omit<PressableProps, "onPress"> & CheckBoxVisualProps;

export type ControlledCheckBoxProps<TFieldValues extends FieldValues> = Omit<
  Omit<PressableProps, "onPress"> & Omit<CheckBoxVisualProps, "value" | "onValueChange">,
  "value" | "onValueChange"
> & {
  name: Path<TFieldValues>;
  control: Control<TFieldValues>;
  rules?: Omit<
    RegisterOptions<TFieldValues, Path<TFieldValues>>,
    "valueAsNumber" | "valueAsDate" | "setValueAs"
  >;
  defaultValue?: boolean;
};

export type CheckBoxProps<TFieldValues extends FieldValues = FieldValues> =
  | CheckBoxBaseProps
  | ControlledCheckBoxProps<TFieldValues>;

type BoxStyleProps = {
  size: number;
  checked: boolean;
  color: string;
  uncheckedColor: string;
  borderColor: string;
  borderWidth: number;
  radius: number;
  disabled?: boolean;
};

function CheckBoxBase({
  value,
  onValueChange,
  disabled = false,
  size = 20,
  color,
  uncheckedColor = "transparent",
  borderColor,
  borderWidth = 2,
  radius = 6,
  label,
  labelPosition = "right",
  labelStyle,
  containerStyle,
  checkboxStyle,
  accessibilityLabel,
  testID,
  ...pressableProps
}: CheckBoxBaseProps) {
  const { theme } = useMobileTheme();

  // Resolve colors with theme fallbacks
  const resolvedColor = color || theme.colorPrimary || "#111827";
  const onPress = useCallback(() => {
    if (disabled) return;
    onValueChange?.(!value);
  }, [disabled, onValueChange, value]);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      {...pressableProps}
    >
      <Root labelPosition={labelPosition} style={containerStyle}>
        <Box
          size={size}
          checked={value}
          color={resolvedColor}
          uncheckedColor={uncheckedColor}
          borderColor={borderColor || theme.color.primary.border}
          borderWidth={borderWidth}
          radius={radius}
          disabled={disabled}
          style={checkboxStyle}
        >
          {value ? <CheckMark size={size}>✓</CheckMark> : null}
        </Box>

        {label ? (
          <Label labelPosition={labelPosition} style={labelStyle}>
            {label}
          </Label>
        ) : null}
      </Root>
    </Pressable>
  );
}

export function CheckBox<TFieldValues extends FieldValues>(props: CheckBoxProps<TFieldValues>) {
  if ("control" in props) {
    const { name, control, rules, defaultValue = false, ...rest } = props;
    return (
      <Controller
        name={name}
        control={control}
        rules={rules}
        defaultValue={defaultValue as any}
        render={({ field: { value, onChange } }) => (
          <CheckBoxBase
            {...(rest as Omit<CheckBoxBaseProps, "value" | "onValueChange">)}
            value={Boolean(value)}
            onValueChange={(next) => onChange(next)}
          />
        )}
      />
    );
  }

  return <CheckBoxBase {...props} />;
}

export function ControlledCheckBox<TFieldValues extends FieldValues>(
  props: ControlledCheckBoxProps<TFieldValues>
) {
  return <CheckBox {...props} />;
}

const Root = styled.View<{ labelPosition: "left" | "right" | "top" | "bottom" }>`
  flex-direction: ${({ labelPosition }) =>
    labelPosition === "right"
      ? "row"
      : labelPosition === "left"
        ? "row-reverse"
        : labelPosition === "bottom"
          ? "column"
          : "column-reverse"};

  justify-content: center;
  align-items: center;

  padding-top: 4px;
  padding-bottom: 4px;

  ${({ labelPosition }) =>
    labelPosition === "top" || labelPosition === "bottom" ? "gap: 4px;" : "column-gap: 10px;"}
`;

const Box = styled.View<BoxStyleProps>`
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  border-radius: ${({ radius }) => radius}px;

  border-width: ${({ borderWidth }) => borderWidth}px;
  border-color: ${({ disabled, theme, borderColor }) =>
    disabled ? (theme.color?.grey?.border ?? "#e2e8f0") : borderColor};

  align-items: center;
  justify-content: center;

  background-color: ${({ disabled, theme, checked, color, uncheckedColor }) =>
    disabled ? (theme.color?.grey?.bg ?? "#f8fafc") : checked ? color : uncheckedColor};

  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
`;

const CheckMark = styled.Text<{ size: number }>`
  color: ${({ theme }) => theme.color?.default?.onMain ?? "#ffffff"};
  font-size: ${({ size }) => Math.max(12, Math.round(size * 0.8))}px;
  height: ${({ size }) => size}px;
  text-align: center;
  font-weight: 700;
`;

const Label = styled.Text<{
  labelPosition: "left" | "right" | "top" | "bottom";
}>`
  color: ${({ theme }) => theme.color?.default?.text ?? "#111827"};
  font-size: 14px;
  line-height: 20px;
  flex-shrink: 1;

  text-align: ${({ labelPosition }) =>
    labelPosition === "top" || labelPosition === "bottom" ? "center" : "left"};
`;
