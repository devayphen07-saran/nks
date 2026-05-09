import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, TouchableOpacity } from "react-native";
import styled from "styled-components/native";
import { useSelector } from "react-redux";
import {
  BottomSheetModal,
  Column,
  LucideIcon,
  Row,
  Typography,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { getMyStores } from "@nks/api-manager";
import type { StoreSummary } from "@nks/api-manager";
import { useRootDispatch } from "../../store";
import type { RootState } from "../../store";
import {
  selectStore,
  OfflineCannotSwitchStoreError,
  StoreSyncInProgressError,
} from "../../lib/store/select-store";
import { handleError } from "../../shared/errors";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called once the active store has been switched. */
  onSwitched?: () => void;
  /** Called when the user taps "Create new store". */
  onCreateStore: () => void;
  /**
   * Optional element rendered in the sheet header's left slot. Used by the
   * no-store screen to surface a back button when the sheet is the only
   * affordance visible (the backdrop covers the page behind it).
   */
  headerLeft?: React.ReactNode;
}

type Phase =
  | { kind: "loading" }
  | { kind: "ready";  owned: StoreSummary[]; staff: StoreSummary[] }
  | { kind: "error";  message: string }
  | { kind: "switching" };

interface ListItem {
  type:  "section" | "store";
  key:   string;
  label?: string;
  store?: StoreSummary;
}

export function StoreSwitcherSheet({ visible, onClose, onSwitched, onCreateStore, headerLeft }: Props) {
  const { theme } = useMobileTheme();
  const dispatch = useRootDispatch();
  const activeStoreGuuid = useSelector((s: RootState) => s.store.activeStoreGuuid);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const loadStores = useCallback(async () => {
    setPhase({ kind: "loading" });
    try {
      const res = await dispatch(getMyStores({})).unwrap();
      setPhase({
        kind:  "ready",
        owned: res.data.myStores,
        staff: res.data.invitedStores,
      });
    } catch (err) {
      const appError = handleError(err, { action: "list_stores_for_switch" });
      setPhase({ kind: "error", message: appError.getUserMessage() });
    }
  }, [dispatch]);

  useEffect(() => {
    if (visible) loadStores();
  }, [visible, loadStores]);

  const handleSelect = useCallback(
    async (store: StoreSummary) => {
      if (store.guuid === activeStoreGuuid) {
        onClose();
        return;
      }
      setPhase({ kind: "switching" });
      try {
        await selectStore({
          storeId:    store.id,
          storeGuuid: store.guuid,
          storeName:  store.storeName,
          dispatch,
          previousStoreGuuid: activeStoreGuuid,
        });
        onClose();
        onSwitched?.();
      } catch (err) {
        if (err instanceof OfflineCannotSwitchStoreError) {
          setPhase({ kind: "error", message: "You're offline — connect to the internet to switch stores." });
          return;
        }
        if (err instanceof StoreSyncInProgressError) {
          setPhase({ kind: "error", message: "Another store is syncing. Please wait and try again." });
          return;
        }
        const appError = handleError(err, { action: "switch_store" });
        setPhase({ kind: "error", message: appError.getUserMessage() });
      }
    },
    [activeStoreGuuid, dispatch, onClose, onSwitched],
  );

  const handleCreateStore = useCallback(() => {
    onClose();
    onCreateStore();
  }, [onClose, onCreateStore]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Switch Store"
      height={560}
      headerLeft={headerLeft}
    >
      <SheetBody>
        <SheetContent>
          {phase.kind === "loading" && (
            <Centered>
              <ActivityIndicator />
              <Typography.Caption type="secondary">Loading stores...</Typography.Caption>
            </Centered>
          )}

          {phase.kind === "error" && (
            <Centered>
              <LucideIcon name="TriangleAlert" size={32} color={theme.colorError} />
              <Typography.Body>{phase.message}</Typography.Body>
              <RetryButton onPress={loadStores}>
                <Typography.Body weight="semiBold" style={{ color: theme.colorPrimary }}>
                  Retry
                </Typography.Body>
              </RetryButton>
            </Centered>
          )}

          {phase.kind === "ready" && (
            <FlatList
              data={buildListItems(phase.owned, phase.staff)}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => {
                if (item.type === "section") {
                  return <SectionLabel>{item.label}</SectionLabel>;
                }
                const store = item.store!;
                return (
                  <StoreRow
                    store={store}
                    isActive={store.guuid === activeStoreGuuid}
                    onPress={() => handleSelect(store)}
                  />
                );
              }}
              ListEmptyComponent={
                <Centered>
                  <LucideIcon name="Store" size={32} color={theme.colorTextSecondary} />
                  <Typography.Body weight="semiBold">No stores yet</Typography.Body>
                  <Typography.Caption type="secondary">
                    Create your first store to get started.
                  </Typography.Caption>
                </Centered>
              }
            />
          )}

          {phase.kind === "switching" && (
            <Centered>
              <ActivityIndicator />
              <Typography.Body>Syncing store data...</Typography.Body>
            </Centered>
          )}
        </SheetContent>

        <SheetFooter>
          <CreateStoreButton onPress={handleCreateStore} activeOpacity={0.7}>
            <LucideIcon name="Plus" size={18} color={theme.colorPrimary} />
            <Typography.Body weight="semiBold" style={{ color: theme.colorPrimary }}>
              Create new store
            </Typography.Body>
          </CreateStoreButton>
        </SheetFooter>
      </SheetBody>
    </BottomSheetModal>
  );
}

function buildListItems(owned: StoreSummary[], staff: StoreSummary[]): ListItem[] {
  const items: ListItem[] = [];
  if (owned.length > 0) {
    items.push({ type: "section", key: "section-owned", label: "Owner" });
    for (const s of owned) {
      items.push({ type: "store", key: `owned-${s.guuid}`, store: s });
    }
  }
  if (staff.length > 0) {
    items.push({ type: "section", key: "section-staff", label: "Staff" });
    for (const s of staff) {
      items.push({ type: "store", key: `staff-${s.guuid}`, store: s });
    }
  }
  return items;
}

interface RowProps {
  store: StoreSummary;
  isActive: boolean;
  onPress: () => void;
}

function StoreRow({ store, isActive, onPress }: RowProps) {
  const { theme } = useMobileTheme();
  return (
    <RowTouchable onPress={onPress} activeOpacity={0.7}>
      <Row align="center" gap="medium" style={{ flex: 1 }}>
        <IconBg>
          <LucideIcon name="Store" size={20} color={theme.colorPrimary} />
        </IconBg>
        <Column gap="xxSmall" style={{ flex: 1 }}>
          <Typography.Body weight="semiBold">{store.storeName}</Typography.Body>
          <Typography.Caption type="secondary">
            {store.storeCode ?? "—"}
          </Typography.Caption>
        </Column>
        {isActive && (
          <LucideIcon name="Check" size={20} color={theme.colorPrimary} />
        )}
      </Row>
    </RowTouchable>
  );
}

const SheetBody = styled.View`
  flex: 1;
`;

const SheetContent = styled.View`
  flex: 1;
`;

const SheetFooter = styled.View`
  padding: 12px 16px;
  border-top-width: 1px;
  border-top-color: ${({ theme }) => theme.colorBorderSecondary};
  background-color: ${({ theme }) => theme.colorBgContainer};
`;

const CreateStoreButton = styled(TouchableOpacity)`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 12px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorPrimary};
  background-color: ${({ theme }) => theme.colorPrimaryBg};
`;

const Centered = styled(Column)`
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
`;

const RetryButton = styled(TouchableOpacity)`
  padding: 8px 16px;
`;

const RowTouchable = styled(TouchableOpacity)`
  padding: 14px 16px;
  border-bottom-width: 1px;
  border-bottom-color: ${({ theme }) => theme.colorBorderSecondary};
`;

const IconBg = styled.View`
  width: 36px;
  height: 36px;
  border-radius: 18px;
  background-color: ${({ theme }) => theme.colorPrimaryBg};
  align-items: center;
  justify-content: center;
`;

const SectionLabel = styled(Typography.Caption)`
  padding: 12px 16px 6px 16px;
  color: ${({ theme }) => theme.colorTextSecondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
`;
