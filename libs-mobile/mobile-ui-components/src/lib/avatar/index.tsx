import React from "react";
import { TouchableOpacity, ViewProps, ActivityIndicator } from "react-native";
import styled from "styled-components/native";
import { ColorType, useMobileTheme } from "@nks/mobile-theme";
import { LucideIcon, LucideIconNameType } from "../lucide-icon";
import { Typography } from "../typography";

interface AvatarProps extends ViewProps {
  uri?: string;
  initials?: string;
  size?: number;
  iconName?: LucideIconNameType;
  iconColor?: string;
  bgColor?: string;
  colorType?: ColorType;
  onPress?: () => void;
  disabled?: boolean;
  shape?: "circle" | "square";
  status?: "active" | "inactive";
  loading?: boolean;
  borderWidth?: number;
  borderColor?: string;
  showBorder?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  initials,
  size = 40,
  style,
  colorType,
  iconName,
  onPress,
  disabled,
  shape = "circle",
  bgColor,
  iconColor,
  status,
  loading,
  borderWidth,
  borderColor,
  showBorder,
  ...rest
}) => {
  const { theme } = useMobileTheme();

  const avatarInitials =
    initials && initials.length >= 2
      ? `${initials[0]}${initials[1]}`.toUpperCase()
      : initials?.toUpperCase();

  const resolvedColorType = colorType ?? ColorType.primary;

  const backgroundColor = bgColor || theme.color?.[resolvedColorType]?.bg || theme.colorBgContainer;

  const textColor = theme.color?.[resolvedColorType]?.main || theme.colorText;

  return (
    <AvatarWrapper size={size} style={style} {...rest}>
      <AvatarContainer
        size={size}
        shape={shape}
        hasImage={!!uri}
        backgroundColor={backgroundColor}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        borderWidth={borderWidth}
        borderColor={borderColor}
        showBorder={showBorder}
      >
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : uri ? (
          <StyledImage source={{ uri }} size={size} shape={shape} />
        ) : avatarInitials ? (
          <Typography.H5
            style={{
              color: textColor,
              fontWeight: "700",
              fontSize: size * 0.4,
            }}
          >
            {avatarInitials}
          </Typography.H5>
        ) : iconName ? (
          <LucideIcon name={iconName} color={iconColor || theme.colorPrimary} size={size * 0.6} />
        ) : (
          <LucideIcon name="User" color={textColor} size={size * 0.6} />
        )}
      </AvatarContainer>

      {status && (
        <StatusDot
          size={size * 0.3}
          shape={shape}
          color={
            status === "active" ? theme.colorSuccess || "#52c41a" : theme.colorError || "#ff4d4f"
          }
        />
      )}
    </AvatarWrapper>
  );
};

/* ---------------------------------- */
/* Styled components (RN SAFE)         */
/* ---------------------------------- */

const AvatarWrapper = styled.View<{ size: number }>(({ size }) => ({
  position: "relative",
  width: size,
  height: size,
}));

const AvatarContainer = styled(TouchableOpacity)<{
  size: number;
  shape: "circle" | "square";
  backgroundColor: string;
  hasImage: boolean;
  borderWidth?: number;
  borderColor?: string;
  showBorder?: boolean;
}>(({ size, shape, backgroundColor, hasImage, theme, borderWidth, borderColor, showBorder }) => ({
  width: size,
  height: size,
  borderRadius: shape === "circle" ? size / 2 : 8,
  backgroundColor: hasImage ? "transparent" : backgroundColor,
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  borderWidth: showBorder ? (borderWidth ?? 1) : hasImage ? 1 : 0,
  borderColor: borderColor ?? theme.colorBorderSecondary ?? "#f0f0f0",
}));

const StyledImage = styled.Image<{
  size: number;
  shape: "circle" | "square";
}>(({ size, shape }) => ({
  width: size,
  height: size,
  borderRadius: shape === "circle" ? size / 2 : 8,
}));

const StatusDot = styled.View<{
  size: number;
  color: string;
  shape: "circle" | "square";
}>(({ size, color, shape, theme }) => ({
  position: "absolute",
  bottom: shape === "circle" ? 0 : -2,
  right: shape === "circle" ? 0 : -2,
  width: size,
  height: size,
  borderRadius: size / 2,
  borderWidth: 2,
  borderColor: theme.colorWhite || "#ffffff",
  backgroundColor: color,
}));

export default Avatar;
