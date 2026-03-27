import React from "react";
import { Platform, TextProps, TextStyle } from "react-native";
import styled, { css } from "styled-components/native";
import { variantTypography, weightTypography, typeTypography } from "./style";
import { ColorType } from "@nks/mobile-theme";

// ─── Types ──────────────────────────────────────────────────────────────

export type TypographyVariant =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "subtitle"
  | "body"
  | "caption"
  | "overline";

export type TypographyWeight = "normal" | "bold" | "medium" | "semiBold" | "light" | number;

export type TypographyType = "primary" | "secondary" | "default";

export interface TypographyProps extends Omit<TextProps, "style"> {
  variant?: TypographyVariant;
  color?: string;
  weight?: TypographyWeight;
  type?: TypographyType;
  colorType?: ColorType;
  children: React.ReactNode;
  style?: TextStyle | TextStyle[];
}

// ─── Component ──────────────────────────────────────────────────────────

const BaseTypography: React.FC<TypographyProps> = ({
  variant = "body",
  type = "default",
  colorType,
  ...props
}) => {
  return <StyledText variant={variant} type={type} $colorType={colorType} {...props} />;
};

/* ---------------- Variant Factory ---------------- */

const createTypographyVariant =
  (variant: TypographyVariant) => (props: Omit<TypographyProps, "variant">) => (
    <BaseTypography variant={variant} {...props} />
  );

/* ---------------- Export API ---------------- */

export const Typography = Object.assign(BaseTypography, {
  H1: createTypographyVariant("h1"),
  H2: createTypographyVariant("h2"),
  H3: createTypographyVariant("h3"),
  H4: createTypographyVariant("h4"),
  H5: createTypographyVariant("h5"),
  Subtitle: createTypographyVariant("subtitle"),
  Body: createTypographyVariant("body"),
  Caption: createTypographyVariant("caption"),
  Overline: createTypographyVariant("overline"),
});

export default Typography;

// ─── Styles ─────────────────────────────────────────────────────────────

const StyledText = styled.Text<{
  variant: TypographyVariant;
  color?: string;
  weight?: TypographyWeight | number;
  type?: TypographyType;
  $colorType?: ColorType;
}>`
  ${({ variant, theme }) =>
    (variantTypography[variant]
      ? variantTypography[variant](theme)
      : variantTypography["body"](theme)) as any}

  ${({ weight, theme }) =>
    (typeof weight === "number"
      ? css`
          font-weight: ${String(weight)};
        `
      : weightTypography[weight ?? "normal"](theme)) as any}

  ${({ type, theme }) => typeTypography[type ?? "default"](theme) as any}

  color: ${({ $colorType, theme, color }) =>
    $colorType ? theme.color[$colorType].main : color || theme.colorText};

  ${Platform.select({
    android: css`
      include-font-padding: false;
      padding-vertical: 0px;
      margin-vertical: 0px;
    `,
  })}
`;
