import React from "react";
import { ViewStyle, StyleProp } from "react-native";
import styled from "styled-components/native";
import { useMobileTheme } from "@nks/mobile-theme";

// ─── Types ──────────────────────────────────────────────────────────────

export interface DividerProps {
  orientation?: "horizontal" | "vertical";
  thickness?: number;
  color?: string;
  inset?: number;
  insetLeft?: number;
  insetRight?: number;
  insetTop?: number;
  insetBottom?: number;
  marginVertical?: number;
  marginHorizontal?: number;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────

export const Divider: React.FC<DividerProps> = ({
  orientation = "horizontal",
  thickness = 1,
  color,
  inset = 0,
  insetLeft,
  insetRight,
  insetTop,
  insetBottom,
  marginVertical = 8,
  marginHorizontal = 0,
  style,
  fullWidth = true,
}) => {
  const { theme } = useMobileTheme();
  const activeColor = color || theme.colorBorder || "#e0e0e0";

  if (orientation === "vertical") {
    return (
      <VerticalLine
        $thickness={thickness}
        $color={activeColor}
        $marginTop={insetTop ?? inset}
        $marginBottom={insetBottom ?? inset}
        $marginHorizontal={marginHorizontal}
        style={style}
      />
    );
  }

  return (
    <HorizontalLine
      $thickness={thickness}
      $color={activeColor}
      $marginLeft={insetLeft ?? inset}
      $marginRight={insetRight ?? inset}
      $marginVertical={marginVertical}
      $fullWidth={fullWidth}
      style={style}
    />
  );
};

export default Divider;

// ─── Styles ─────────────────────────────────────────────────────────────

const HorizontalLine = styled.View<{
  $thickness: number;
  $color: string;
  $marginLeft: number;
  $marginRight: number;
  $marginVertical: number;
  $fullWidth: boolean;
}>`
  height: ${({ $thickness }) => $thickness}px;
  background-color: ${({ $color }) => $color};
  margin-top: ${({ $marginVertical }) => $marginVertical}px;
  margin-bottom: ${({ $marginVertical }) => $marginVertical}px;
  margin-left: ${({ $marginLeft }) => $marginLeft}px;
  margin-right: ${({ $marginRight }) => $marginRight}px;
  align-self: ${({ $fullWidth }) => ($fullWidth ? "stretch" : "auto")};
`;

const VerticalLine = styled.View<{
  $thickness: number;
  $color: string;
  $marginTop: number;
  $marginBottom: number;
  $marginHorizontal: number;
}>`
  width: ${({ $thickness }) => $thickness}px;
  background-color: ${({ $color }) => $color};
  margin-top: ${({ $marginTop }) => $marginTop}px;
  margin-bottom: ${({ $marginBottom }) => $marginBottom}px;
  margin-left: ${({ $marginHorizontal }) => $marginHorizontal}px;
  margin-right: ${({ $marginHorizontal }) => $marginHorizontal}px;
`;