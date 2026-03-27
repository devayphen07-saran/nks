import React from "react";
import { ViewProps } from "react-native";
import styled from "styled-components/native";
import { SizeType } from "@nks/mobile-theme";

export type Spacing = keyof SizeType | number;

export interface FlexProps extends ViewProps {
  gap?: Spacing;
  align?: "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
  justify?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly";
  padding?: Spacing;
  margin?: Spacing;
  direction?: "row" | "column";
  wrap?: "wrap" | "nowrap";
  width?: string | number;
  height?: string | number;
  bg?: string;
  radius?: number;
  border?: string;
  flex?: number;
  children?: React.ReactNode;
}

export const StyledFlex: React.FC<FlexProps> = styled.View<FlexProps>`
  display: flex;
  flex-direction: ${({ direction }) => direction || "column"};
  justify-content: ${({ justify }) => justify || "flex-start"};
  align-items: ${({ align }) => align || "stretch"};
  flex-wrap: ${({ wrap }) => wrap || "nowrap"};
  ${(props) => {
    const { flex, gap, padding, margin, width, height, bg, radius, border, theme } = props;
    const styles: any = {};

    if (flex !== undefined) styles.flex = flex;
    if (gap !== undefined) {
      if (typeof gap === "number") styles.gap = gap;
      else if (theme.sizing && (gap as any) in theme.sizing)
        styles.gap = (theme.sizing as any)[gap];
    }

    if (padding !== undefined) {
      if (typeof padding === "number") styles.padding = padding;
      else if (theme.sizing && (padding as any) in theme.sizing)
        styles.padding = (theme.sizing as any)[padding];
    }

    if (margin !== undefined) {
      if (typeof margin === "number") styles.margin = margin;
      else if (theme.sizing && (margin as any) in theme.sizing)
        styles.margin = (theme.sizing as any)[margin];
    }

    if (width !== undefined) styles.width = width;
    if (height !== undefined) styles.height = height;

    if (bg) {
      const colorObj = theme.color as any;
      if (colorObj?.[bg]?.main) styles.backgroundColor = colorObj[bg].main;
      else if ((theme as any)[bg]) styles.backgroundColor = (theme as any)[bg];
      else styles.backgroundColor = bg;
    }

    if (radius !== undefined) {
      if (typeof radius === "number") styles.borderRadius = radius;
      else if (theme.borderRadius && (radius as any) in theme.borderRadius)
        styles.borderRadius = (theme.borderRadius as any)[radius];
    }

    if (border) {
      styles.borderWidth = 1;
      styles.borderColor = theme.colorBorder;
    }

    return styles;
  }}
`;

export const Flex: React.FC<FlexProps> = StyledFlex;

export const Row: React.FC<FlexProps> = (props) => {
  return <StyledFlex direction="row" {...props} />;
};

export const Column: React.FC<FlexProps> = (props) => {
  return <StyledFlex direction="column" {...props} />;
};
