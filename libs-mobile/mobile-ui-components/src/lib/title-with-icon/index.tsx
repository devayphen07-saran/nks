import React from "react";
import styled from "styled-components/native";
import { View } from "react-native";
import { Row } from "../layout";
import { LucideIcon, LucideIconNameType } from "../lucide-icon";
import { Typography } from "../typography";

export interface TitleWithIconProps {
  uri?: string;
  size?: number;
  iconName?: LucideIconNameType;
  iconColor?: string;
  title: string;
  borderRadius?: number;
  fallbackIcon?: string;
  previewEnabled?: boolean;
}

export const TitleWithIcon: React.FC<TitleWithIconProps> = ({
  iconName = "Box",
  iconColor,
  title,
}) => {
  return (
    <IconDetail>
      <Row gap={3} align="center">
        <LucideIcon name={iconName} size={10} color={iconColor} />
        <Typography.Caption
          style={{
            fontSize: 10,
            includeFontPadding: false,
          }}
          type="secondary"
        >
          {title}
        </Typography.Caption>
      </Row>
    </IconDetail>
  );
};

const IconDetail = styled(View)(({ theme }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-end",
  borderRadius: 10,
  paddingTop: 5,
  paddingRight: 9,
  paddingBottom: 0,
  paddingLeft: 0,
}));
