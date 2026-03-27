import React from "react";
import { TouchableOpacity, ViewStyle, Platform } from "react-native";
import styled, { css } from "styled-components/native";
import { useMobileTheme } from "@nks/mobile-theme";

// ─── Types ──────────────────────────────────────────────────────────────

export type CardPadding = "none" | "small" | "medium" | "large";

interface CardProps {
  children?: React.ReactNode;
  bordered?: boolean;
  shadow?: boolean;
  padding?: CardPadding;
  style?: ViewStyle;
  onPress?: () => void;
  backgroundColor?: string;
}

// ─── Component ──────────────────────────────────────────────────────────

export const Card: React.FC<CardProps> = ({
  children,
  bordered = true,
  shadow = false,
  padding = "medium",
  style,
  onPress,
  backgroundColor,
}) => {
  const content = (
    <CardBase
      $bordered={bordered}
      $shadow={shadow}
      $padding={padding}
      $backgroundColor={backgroundColor}
      style={!onPress ? style : undefined}
    >
      {children}
    </CardBase>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={style}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

export default Card;

// ─── Styles ─────────────────────────────────────────────────────────────

const CardBase = styled.View<{
  $bordered: boolean;
  $shadow: boolean;
  $backgroundColor?: string;
  $padding: CardPadding;
}>`
  background-color: ${({ theme, $backgroundColor }) =>
    $backgroundColor || theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  border-width: ${({ theme, $bordered }) =>
    $bordered ? theme.borderWidth.thin : 0}px;
  border-color: ${({ theme }) => theme.colorBorder || "#f0f0f0"};
  overflow: hidden;

  padding: ${({ $padding, theme }) => {
    switch ($padding) {
      case "small":
        return theme.sizing.xSmall;
      case "medium":
        return theme.sizing.medium;
      case "large":
        return theme.sizing.large;
      default:
        return 0;
    }
  }}px;

  ${({ $shadow }) =>
    $shadow &&
    Platform.select({
      ios: css`
        shadow-color: #000;
        shadow-opacity: 0.08;
        shadow-radius: 8px;
        shadow-offset: 0px 4px;
      `,
      android: css`
        elevation: 3;
      `,
    })}
`;
