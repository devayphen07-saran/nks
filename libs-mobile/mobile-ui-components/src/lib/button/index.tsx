import React from "react";
import { TouchableOpacityProps, ActivityIndicator } from "react-native";
import styled from "styled-components/native";
import { buttonTextVariant, buttonVariant } from "./style";
import { LucideIcon, LucideIconNameType } from "../lucide-icon";
import { Typography } from "../typography";
import { useMobileTheme, ColorType } from "@nks/mobile-theme";
import { Row } from "../layout";

type ButtonVariant = "primary" | "default" | "dashed" | "text";
export type ButtonSize = "xsm" | "sm" | "md" | "lg" | "xlg";

interface ButtonProps extends TouchableOpacityProps {
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
  iconName?: LucideIconNameType;
  iconElement?: React.ReactNode;
  borderColor?: string;
  textColor?: string;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  loading = false,
  disabled = false,
  size = "md",
  variant = "primary",
  iconName,
  iconElement,
  borderColor,
  textColor,
  ...rest
}) => {
  const { theme } = useMobileTheme();

  const resolvedTextColor = textColor || (variant === "primary" ? theme.colorWhite : undefined);

  const spinnerColor = variant === "primary" ? theme.colorWhite : theme.colorPrimary;

  return (
    <ButtonContainer
      activeOpacity={0.88}
      disabled={disabled || loading}
      variant={variant}
      $size={size}
      $borderColor={borderColor}
      {...rest}
    >
      {loading ? (
        <Row gap={10}>
          <ActivityIndicator color={spinnerColor} />
          {label && (
            <ButtonText $size={size} variant={variant} color={resolvedTextColor}>
              {label}
            </ButtonText>
          )}
        </Row>
      ) : (
        <RowView>
          {iconName && (
            <LucideIcon
              name={iconName}
              size={20}
              color={resolvedTextColor}
              colorType={variant === "primary" ? undefined : ColorType.primary}
            />
          )}

          {iconElement && <IconWrapper>{iconElement}</IconWrapper>}

          {label && (
            <ButtonText $size={size} variant={variant} color={resolvedTextColor}>
              {label}
            </ButtonText>
          )}
        </RowView>
      )}
    </ButtonContainer>
  );
};

/* ---------------------------------- */
/* Layout helpers                      */
/* ---------------------------------- */

const RowView = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 10px;
`;

const IconWrapper = styled.View`
  align-items: center;
  justify-content: center;
`;

/* ---------------------------------- */
/* Size configs                        */
/* ---------------------------------- */

const sizeConfigs: Record<
  ButtonSize,
  {
    height?: number;
    paddingVertical: number;
    paddingHorizontal: number;
    borderRadius: number;
  }
> = {
  xsm: { height: 26, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4 },
  sm: { height: 32, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 4 },
  md: { height: 40, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  lg: { height: 48, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  xlg: { height: 56, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
};

/* ---------------------------------- */
/* Styled components                   */
/* ---------------------------------- */

const ButtonContainer = styled.TouchableOpacity<{
  variant: ButtonVariant;
  disabled?: boolean;
  $size: ButtonSize;
  $borderColor?: string;
}>`
  ${({ variant, theme }) => buttonVariant[variant](theme)}

  flex-direction: row;
  align-items: center;
  justify-content: center;

  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};

  height: ${({ $size }) => sizeConfigs[$size].height}px;
  border-radius: ${({ $size }) => sizeConfigs[$size].borderRadius}px;
  padding-top: ${({ $size }) => sizeConfigs[$size].paddingVertical}px;
  padding-bottom: ${({ $size }) => sizeConfigs[$size].paddingVertical}px;
  padding-left: ${({ $size }) => sizeConfigs[$size].paddingHorizontal}px;
  padding-right: ${({ $size }) => sizeConfigs[$size].paddingHorizontal}px;

  ${({ $borderColor }) =>
    $borderColor
      ? `
    border-color: ${$borderColor};
    border-width: 1px;
  `
      : ""}
`;

const ButtonText = styled(Typography.Subtitle)<{
  variant: ButtonVariant;
  $size: ButtonSize;
  color?: string;
}>`
  ${({ variant, theme }) => buttonTextVariant[variant](theme)}
  letter-spacing: 0.5px;
  ${({ color }) => (color ? `color: ${color};` : "")}
`;

export default Button;
