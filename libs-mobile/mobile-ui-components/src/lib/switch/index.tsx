import React, { useRef, useEffect, useState } from "react";
import { Animated } from "react-native";
import styled from "styled-components/native";
import { Controller, Control, FieldValues, Path, RegisterOptions } from "react-hook-form";
import { Typography } from "../typography";
import { useMobileTheme } from "@nks/mobile-theme";

interface SwitchProps<T extends FieldValues = any> {
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: number;
  style?: any;
  name?: Path<T>;
  control?: Control<T>;
  rules?: RegisterOptions<T, Path<T>>;
  label?: string;
  labelPosition?: "top" | "left" | "right";
  required?: boolean;
}

export function Switch<T extends FieldValues = any>({
  defaultChecked = false,
  onChange,
  disabled = false,
  size = 40,
  style,
  name,
  control,
  rules,
  label,
  labelPosition = "top",
  required = false,
}: SwitchProps<T>) {
  const { theme } = useMobileTheme();

  const offset = useRef(new Animated.Value(defaultChecked ? 1 : 0)).current;
  const [internalChecked, setInternalChecked] = useState(defaultChecked);

  const animate = (val: boolean) => {
    Animated.timing(offset, {
      toValue: val ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  const trackWidth = size * 1.22;
  const thumbSize = size * 0.55;
  const trackPadding = Math.max(2, size * 0.05);
  const thumbEnd = Math.max(trackPadding, trackWidth - thumbSize - trackPadding);

  const thumbLeft = offset.interpolate({
    inputRange: [0, 1],
    outputRange: [trackPadding, thumbEnd],
  });

  useEffect(() => {
    animate(internalChecked);
  }, [internalChecked]);

  const toggle = (current: boolean, update: (v: boolean) => void) => {
    if (disabled) return;
    const next = !current;
    animate(next);
    update(next);
    onChange?.(next);
  };

  const Label = label ? (
    <Typography.Caption>
      {label}
      {required && (
        <Typography.Body type="secondary" style={{ color: theme.color?.red?.main || "#dc2626" }}>
          {" *"}
        </Typography.Body>
      )}
    </Typography.Caption>
  ) : null;

  const SwitchUI = (checked: boolean, onToggle: () => void) => (
    <Wrapper labelPosition={labelPosition}>
      {(labelPosition === "top" || labelPosition === "left") && Label}

      <SwitchTrack
        onPress={onToggle}
        disabled={disabled}
        $checked={checked}
        $size={size}
        style={style}
        accessibilityRole="switch"
        accessibilityState={{ checked, disabled }}
        activeOpacity={0.8}
      >
        <Thumb style={{ left: thumbLeft }} $size={size} />
      </SwitchTrack>

      {labelPosition === "right" && Label}
    </Wrapper>
  );

  /* ---------------- Controlled ---------------- */
  if (name && control) {
    return (
      <Controller
        name={name}
        control={control}
        rules={rules}
        render={({ field: { value, onChange: formChange } }: { field: { value: any; onChange: (v: any) => void } }) => {
          const checked = !!value;
          useEffect(() => animate(checked), [checked]);
          return SwitchUI(checked, () => toggle(checked, formChange));
        }}
      />
    );
  }

  /* ---------------- Uncontrolled ---------------- */
  return SwitchUI(internalChecked, () => toggle(internalChecked, setInternalChecked));
}

/* ---------------- Styles ---------------- */

const Wrapper = styled.View<{ labelPosition: "top" | "left" | "right" }>`
  flex-direction: ${({ labelPosition }) =>
    labelPosition === "top" ? "column" : labelPosition === "left" ? "row-reverse" : "row"};
  align-items: center;
  gap: 6px;
`;

const SwitchTrack = styled.TouchableOpacity<{
  $checked: boolean;
  $size: number;
}>`
  width: ${({ $size }) => $size * 1.2}px;
  height: ${({ $size }) => $size * 0.6}px;
  border-radius: ${({ $size }) => $size * 0.3}px;
  background-color: ${({ $checked, theme }) =>
    $checked
      ? theme.colorPrimary || "#2563eb"
      : theme.color?.grey?.active || "#e5e7eb"};
  position: relative;
  justify-content: center;
`;

const Thumb = styled(Animated.View)<{ $size: number }>`
  position: absolute;
  width: ${({ $size }) => $size * 0.55}px;
  height: ${({ $size }) => $size * 0.55}px;
  top: ${({ $size }) => ($size * 0.6 - $size * 0.55) / 2}px;
  border-radius: ${({ $size }) => ($size * 0.55) / 2}px;
  background-color: ${({ theme }) => theme.colorWhite || "#ffffff"};
  border-width: 1px;
  border-color: ${({ theme }) => theme.color?.grey?.border || "rgba(15, 23, 42, 0.08)"};
  elevation: 2;
  shadow-color: rgba(15, 23, 42, 0.25);
  shadow-offset: 0px 2px;
  shadow-opacity: 0.3;
  shadow-radius: 3px;
`;

export default Switch;
