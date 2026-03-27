import { useMobileTheme } from "@nks/mobile-theme";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import styled from "styled-components/native";
import { Row } from "../layout";
import { Typography } from "../typography";
import { Divider } from "../divider";
import React from "react";

type ModalHeaderProps = {
  title: string;
  leftText?: string;
  rightText?: string;
  onPressLeft?: () => void;
  onPressRight?: () => void;
  disableRight?: boolean;
  isLoading?: boolean;
};

export function ModalHeader({
  title,
  onPressLeft,
  onPressRight,
  rightText,
  leftText,
  disableRight,
  isLoading,
}: ModalHeaderProps) {
  const { theme } = useMobileTheme();
  const showRight = !!(rightText && onPressRight);

  return (
    <>
      <Row
        justify="space-between"
        padding={"medium"}
        align="center"
        style={{ backgroundColor: theme.colorBgContainer }}
      >
        {showRight ? (
          <>
            <TouchableOpacity
              onPress={onPressLeft}
              style={{
                width: 60,
                alignItems: "flex-start",
                justifyContent: "flex-start",
              }}
            >
              <ToggleText>{leftText ?? "Cancel"}</ToggleText>
            </TouchableOpacity>
            <HeaderTitleContainer>
              <Typography.Subtitle
                weight={"bold"}
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ textAlign: "center" }}
              >
                {title}
              </Typography.Subtitle>
            </HeaderTitleContainer>
            <TouchableOpacity
              onPress={!disableRight ? onPressRight : undefined}
              disabled={disableRight || isLoading}
              style={{
                width: 60,
                alignItems: "flex-end",
                justifyContent: "flex-end",
              }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.colorPrimary || "#007AFF"} />
              ) : (
                <ToggleText disabled={disableRight}>{rightText}</ToggleText>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Typography.Subtitle weight={"bold"}>{title}</Typography.Subtitle>

            <TouchableOpacity onPress={onPressLeft}>
              <ToggleText>{leftText ?? "Cancel"}</ToggleText>
            </TouchableOpacity>
          </>
        )}
      </Row>
      <Divider marginVertical={0} thickness={0.5} />
    </>
  );
}

const ToggleText = styled.Text<{ disabled?: boolean }>`
  font-size: ${({ theme }) => theme.fontSize.small}px;
  color: ${({ theme, disabled }) =>
    disabled ? theme.colorPrimaryBgHover : theme.colorPrimary || "#007AFF"};
`;

const HeaderTitleContainer = styled(View)`
  flex: 1;
  align-items: center;
  justify-content: center;
`;
