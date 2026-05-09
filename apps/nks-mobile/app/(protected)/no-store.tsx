/**
 * No-store welcome screen.
 *
 * Rendered when the user has chosen a Business workspace but has no active
 * store. Sits outside the (store) drawer so the user isn't inside a shell
 * for a store they haven't picked yet.
 *
 * The bottom-sheet switcher is always open. The user must pick a store, tap
 * "Create new store", or tap the back button (rendered in the sheet header)
 * to return to the account-type picker.
 *
 * Why the back button lives in the sheet header (not the screen behind it):
 * the modal's dark backdrop covers the page, so any control on the page
 * itself is invisible and unreachable. The sheet header is the only spot
 * the user can actually touch.
 */

import { useCallback, useEffect } from "react";
import { router } from "expo-router";
import styled from "styled-components/native";
import { useSelector } from "react-redux";
import { Column, LucideIcon, Typography } from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { StoreSwitcherSheet } from "../../features/store/StoreSwitcherSheet";
import { ROUTES } from "../../lib/navigation/routes";
import type { RootState } from "../../store";

export default function NoStoreScreen() {
  const { theme } = useMobileTheme();
  const activeStoreGuuid = useSelector((s: RootState) => s.store.activeStoreGuuid);

  // Once a store becomes active, leave this screen for the store home.
  // Navigation is a side effect — must run from an effect, never inline
  // in the render body (React forbids cross-component state updates
  // during render and the navigation container would warn).
  useEffect(() => {
    if (activeStoreGuuid) {
      router.replace(ROUTES.STORE_HOME);
    }
  }, [activeStoreGuuid]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(ROUTES.ACCOUNT_TYPE);
  }, []);

  const handleCreateStore = useCallback(() => {
    router.push(ROUTES.STORE_SETUP);
  }, []);

  // No-op onClose: the sheet stays open until the user picks a store, taps
  // "Create new store", or uses the back button.
  const handleSheetClose = useCallback(() => {
    // intentionally empty
  }, []);

  return (
    <Container>
      <Body>
        <LucideIcon name="Store" size={56} color={theme.colorTextSecondary} />
        <Column gap="xxSmall" align="center">
          <Typography.H4 weight="semiBold">No store selected</Typography.H4>
          <Typography.Caption type="secondary" style={{ textAlign: "center" }}>
            Pick one of your stores or create a new one to continue.
          </Typography.Caption>
        </Column>
      </Body>

      <StoreSwitcherSheet
        visible={true}
        onClose={handleSheetClose}
        onCreateStore={handleCreateStore}
        headerLeft={
          <BackButton onPress={handleBack} hitSlop={8}>
            <LucideIcon name="ChevronLeft" size={20} color={theme.colorText} />
          </BackButton>
        }
      />
    </Container>
  );
}

const Container = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const Body = styled(Column).attrs({ gap: "medium", align: "center" })`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 32px;
`;

const BackButton = styled.TouchableOpacity`
  padding: 4px;
`;
