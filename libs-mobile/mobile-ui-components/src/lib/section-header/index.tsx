import React from "react";
import { TouchableOpacity, ViewStyle } from "react-native";
import styled from "styled-components/native";
import { Row } from "../layout";
import { Typography } from "../typography";
import { useMobileTheme } from "@nks/mobile-theme";
import { LucideIcon } from "../lucide-icon";

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
  containerStyle?: ViewStyle;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  actionLabel = "View all",
  onActionPress,
  containerStyle,
}) => {
  const { theme } = useMobileTheme();

  return (
    <Container style={containerStyle}>
      <Typography.Subtitle weight="semiBold" style={{ color: theme.colorText }}>
        {title}
      </Typography.Subtitle>
      {onActionPress && (
        <TouchableOpacity onPress={onActionPress} activeOpacity={0.7}>
          <Row gap={5} justify="center" align="center">
            <Typography.Body
              weight="medium"
              style={{ color: theme.color.primary.main, fontSize: 14 }}
            >
              {actionLabel}
            </Typography.Body>
            <LucideIcon name="ArrowRight" size={16} color={theme.color.primary.main} />
          </Row>
        </TouchableOpacity>
      )}
    </Container>
  );
};

const Container = styled(Row)(({ theme }) => ({
  justifyContent: "space-between",
  alignItems: "center",
  paddingHorizontal: theme.padding.small,
}));
