import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import styled from "styled-components/native";
import {
  Alert,
  Column,
  Typography,
  LucideIcon,
  Header,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { router, useNavigation } from "expo-router";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../store";
import { StoreSwitcherSheet } from "../../../../features/store/StoreSwitcherSheet";
import { StoreSwitcherChip } from "../../../../features/store/StoreSwitcherChip";
import { ROUTES } from "../../../../lib/navigation/routes";
import { useSyncStatus } from "../../../../hooks/useSyncStatus";
import { syncManager } from "../../../../lib/sync/sync-manager";
import { createLogger } from "../../../../lib/utils/logger";

const log = createLogger("StoreHomeScreen");

export default function StoreHomeScreen() {
  const { theme } = useMobileTheme();
  const navigation =
    useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const [showSwitcher, setShowSwitcher] = useState(false);
  const activeStoreName = useSelector(
    (s: RootState) => s.store.activeStoreName,
  );
  const { isSyncing, isOnline } = useSyncStatus();

  // Local "I just pressed sync" flag. The hook polls every 5s, so a fast sync
  // can finish before isSyncing ever flips to true — leaving the user with no
  // feedback. This bridges the gap by flipping immediately on tap and clearing
  // when the awaited forceSync settles.
  const [localSyncing, setLocalSyncing] = useState(false);
  const showSpinning = isSyncing || localSyncing;

  const handleCreateStore = useCallback(() => {
    router.push(ROUTES.STORE_SETUP);
  }, []);

  const handleForceSync = useCallback(async () => {
    if (showSpinning || !isOnline) return;
    setLocalSyncing(true);
    try {
      await syncManager.forceSync();
      Alert.info("Sync complete", "Your data is up to date.");
    } catch (err) {
      log.error("Force sync failed:", err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Please try again in a moment.";
      Alert.info("Sync failed", message);
    } finally {
      setLocalSyncing(false);
    }
  }, [showSpinning, isOnline]);

  return (
    <Container>
      <Header
        leftElement={
          <MenuButton onPress={() => navigation.openDrawer()}>
            <LucideIcon name="Menu" size={24} />
          </MenuButton>
        }
        rightElement={
          <RightActions>
            <HeaderIconButton
              onPress={handleForceSync}
              disabled={showSpinning || !isOnline}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={showSpinning ? "Syncing" : "Refresh"}
              accessibilityState={{
                disabled: showSpinning || !isOnline,
                busy: showSpinning,
              }}
            >
              <SpinningRefreshIcon
                spinning={showSpinning}
                color={isOnline ? theme.colorPrimary : theme.colorTextSecondary}
              />
            </HeaderIconButton>
            <HeaderIconButton onPress={handleCreateStore} activeOpacity={0.6}>
              <LucideIcon name="Plus" size={20} color={theme.colorPrimary} />
            </HeaderIconButton>
            <StoreSwitcherChip
              storeName={activeStoreName}
              onPress={() => setShowSwitcher(true)}
            />
          </RightActions>
        }
      />
      <Content>
        <PlaceholderCard gap="medium" align="center">
          <LucideIcon
            name="LayoutDashboard"
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

      <StoreSwitcherSheet
        visible={showSwitcher}
        onClose={() => setShowSwitcher(false)}
        onCreateStore={handleCreateStore}
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

const MenuButton = styled.TouchableOpacity`
  padding: 8px;
  margin-left: -8px;
`;

const HeaderIconButton = styled.TouchableOpacity`
  padding: 6px;
  border-radius: 999px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
  background-color: ${({ theme }) => theme.colorBgContainer};
  align-items: center;
  justify-content: center;
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
`;

const RightActions = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

function SpinningRefreshIcon({
  spinning,
  color,
}: {
  spinning: boolean;
  color: string;
}) {
  const rotation = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (spinning) {
      rotation.setValue(0);
      loopRef.current = Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      loopRef.current = null;
      rotation.setValue(0);
    }
    return () => {
      loopRef.current?.stop();
      loopRef.current = null;
    };
  }, [spinning, rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <LucideIcon name="RefreshCw" size={20} color={color} />
    </Animated.View>
  );
}
