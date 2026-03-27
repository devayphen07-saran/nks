import React from "react";
import { Row, Column, Typography } from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import styled from "styled-components/native";

interface WelcomeBannerProps {
  name?: string | null;
  subtitle?: string;
}

export function WelcomeBanner({ name, subtitle = "Managing your personal finances" }: WelcomeBannerProps) {
  const { theme } = useMobileTheme();

  return (
    <BannerCard>
      <Row align="center" gap="medium">
        <AvatarCircle>
          <Typography.H4 weight="bold" color={theme.colorPrimary}>
            {name?.[0]?.toUpperCase() ?? "U"}
          </Typography.H4>
        </AvatarCircle>
        <Column flex={1}>
          <Typography.H5 weight="bold" color={theme.colorWhite}>
            {name ?? "Good Morning!"}
          </Typography.H5>
          <Typography.Caption color={theme.colorWhite} style={{ opacity: 0.8 }}>
            {subtitle}
          </Typography.Caption>
        </Column>
      </Row>
    </BannerCard>
  );
}

const BannerCard = styled.View`
  background-color: ${({ theme }) => theme.colorPrimary};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  padding: ${({ theme }) => theme.sizing.xLarge}px;
`;

const AvatarCircle = styled.View`
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background-color: ${({ theme }) => theme.colorWhite};
  align-items: center;
  justify-content: center;
`;
