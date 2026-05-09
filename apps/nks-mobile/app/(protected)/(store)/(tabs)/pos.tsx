import React, { useState } from "react";
import styled from "styled-components/native";
import { Column, Typography, LucideIcon, Header } from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { SyncIndicator } from "../../../../components/sync";
import { DebugDatabaseScreen } from "@/features/debug/DebugDatabaseScreen";

export default function PosScreen() {
  const { theme } = useMobileTheme();
  const [showDebug, setShowDebug] = useState(false);

  return (
    <Container>
      <Header
        title="POS"
        rightElement={
          <StatusGroup>
            <SyncIndicator />
            <DebugButton onPress={() => setShowDebug(true)}>
              <LucideIcon
                name="Database"
                size={20}
                color={theme.colorTextSecondary}
              />
            </DebugButton>
          </StatusGroup>
        }
      />
      <Content>
        <PlaceholderCard gap="medium" align="center">
          <LucideIcon name="ScanBarcode" size={48} color={theme.colorTextSecondary} />
          <Column gap="xxSmall" align="center">
            <Typography.Body weight="semiBold">Point of Sale</Typography.Body>
            <Typography.Caption type="secondary">Coming soon</Typography.Caption>
          </Column>
        </PlaceholderCard>
      </Content>

      <DebugDatabaseScreen
        visible={showDebug}
        onClose={() => setShowDebug(false)}
      />
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

const StatusGroup = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 4px;
`;

const DebugButton = styled.TouchableOpacity`
  padding: 8px;
`;
