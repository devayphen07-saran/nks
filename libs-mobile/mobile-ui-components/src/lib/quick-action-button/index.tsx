import React from "react";
import { TouchableOpacity, TouchableOpacityProps } from "react-native";
import styled from "styled-components/native";
import { ColorType, useMobileTheme } from "@nks/mobile-theme";
import { LucideIcon } from "../lucide-icon";
import { Typography } from "../typography";
import { LucideIconNameType } from "../lucide-icon";
import { Row, Flex } from "../layout";

// ─── Types ──────────────────────────────────────────────────────────────

export interface QuickActionButtonProps extends TouchableOpacityProps {
  title: string;
  description: string;
  icon?: LucideIconNameType;
  arrow?: boolean;
  iconColor?: ColorType;
  rightIcon?: LucideIconNameType;
  bgColor?: string;
}

// ─── Component ──────────────────────────────────────────────────────────

export const QuickActionButton: React.FC<QuickActionButtonProps> = ({
  title,
  description,
  icon,
  arrow = false,
  iconColor = ColorType.primary,
  rightIcon,
  bgColor,
  ...buttonProps
}) => {
  const { theme } = useMobileTheme();

  return (
    <QuickButtonContainer
      {...buttonProps}
      activeOpacity={0.9}
      $bgColor={bgColor}
    >
      <Row justify="space-between" align="center">
        <Row gap={theme.sizing.small}>
          {icon && (
            <IconContainer>
              <LucideIcon
                name={icon}
                size={17}
                color={theme.color[iconColor]?.main || theme.colorPrimary}
              />
            </IconContainer>
          )}
          <Flex flex={1}>
            <Typography.Caption
              weight="medium"
              ellipsizeMode="tail"
              numberOfLines={1}
              style={{ color: theme.colorText }}
            >
              {title}
            </Typography.Caption>
            <Typography.Overline
              ellipsizeMode="tail"
              numberOfLines={1}
              style={{
                marginTop: theme.sizing.xxSmall,
                color: theme.colorTextSecondary,
              }}
            >
              {description}
            </Typography.Overline>
          </Flex>
        </Row>

        {arrow && (
          <LucideIcon name="ChevronRight" size={17} color={theme.colorText} />
        )}
        {rightIcon && (
          <LucideIcon
            name={rightIcon}
            size={17}
            color={theme.color[iconColor]?.main || theme.colorPrimary}
          />
        )}
      </Row>
    </QuickButtonContainer>
  );
};

export default QuickActionButton;

// ─── Styles ─────────────────────────────────────────────────────────────

const QuickButtonContainer = styled.TouchableOpacity<{ $bgColor?: string }>`
  padding: ${({ theme }) => theme.sizing.small}px;
  background-color: ${({ $bgColor, theme }) =>
    $bgColor || theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.xLarge}px;
  flex: 1;
  border-width: ${({ theme }) => theme.borderWidth.mild}px;
  border-color: ${({ theme }) => theme.colorBorder};
`;

const IconContainer = styled.View`
  width: ${({ theme }) => theme.sizing.xLarge + 4}px;
  height: ${({ theme }) => theme.sizing.xLarge + 4}px;
  border-radius: ${({ theme }) => theme.borderRadius.regular}px;
  background-color: ${({ theme }) => theme.color.primary.bg};
  align-items: center;
  justify-content: center;
`;
