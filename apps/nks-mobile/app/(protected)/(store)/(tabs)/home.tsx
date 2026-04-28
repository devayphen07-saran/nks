import React, { useState } from "react";
import styled from "styled-components/native";
import { Column, Typography, LucideIcon, Header } from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { useNavigation } from "expo-router";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { DebugDatabaseScreen } from "@/features/debug/DebugDatabaseScreen";

export default function StoreHomeScreen() {
  const { theme } = useMobileTheme();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const [showDebug, setShowDebug] = useState(false);

  return (
    <Container>
      <Header
        title="Home"
        leftElement={
          <MenuButton onPress={() => navigation.openDrawer()}>
            <LucideIcon name="Menu" size={24} />
          </MenuButton>
        }
        rightElement={
          <DebugButton onPress={() => setShowDebug(true)}>
            <LucideIcon name="Database" size={20} />
          </DebugButton>
        }
      />
      <Content>
        <PlaceholderCard gap="medium" align="center">
          <LucideIcon name="LayoutDashboard" size={48} color={theme.colorTextSecondary} />
          <Column gap="xxSmall" align="center">
            <Typography.Body weight="semiBold">Store Dashboard</Typography.Body>
            <Typography.Caption type="secondary">Coming soon</Typography.Caption>
          </Column>
        </PlaceholderCard>
      </Content>

      <DebugDatabaseScreen visible={showDebug} onClose={() => setShowDebug(false)} />
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

const DebugButton = styled.TouchableOpacity`
  padding: 8px;
  margin-right: -8px;
`;
