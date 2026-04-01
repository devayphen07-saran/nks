import React, { useState } from "react";
import styled from "styled-components/native";
import {
  Column,
  Typography,
  LucideIcon,
  Header,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";

export default function StoreDashboard() {
  const { theme } = useMobileTheme();

  return (
    <Container>
      <Header
        title="Dashboard"
        leftElement={
          <MenuButton>
            <LucideIcon name="Menu" size={24} color={theme.colorWhite} />
          </MenuButton>
        }
      />

      <Content>
        <PlaceholderCard gap="medium" align="center">
          <LucideIcon
            name="Construction"
            size={48}
            color={theme.colorTextSecondary}
          />
          <Column gap="xxSmall" align="center">
            <Typography.Body weight="semiBold">Store Dashboard</Typography.Body>
            <Typography.Caption type="secondary">
              Coming soon
            </Typography.Caption>
          </Column>
        </PlaceholderCard>
      </Content>
    </Container>
  );
}

const Container = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const Content = styled.View`
  flex: 1;
  padding: ${({ theme }) => theme.sizing.xLarge}px;
`;

const PlaceholderCard = styled(Column)`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.xLarge}px;
  padding: ${({ theme }) => theme.sizing.xxLarge}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
`;

const MenuButton = styled.TouchableOpacity`
  padding: 8px;
  margin-left: -8px;
`;
