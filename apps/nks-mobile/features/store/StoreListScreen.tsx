import React, { useEffect, useState, useCallback } from "react";
import {
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import styled from "styled-components/native";
import {
  Column,
  Row,
  Typography,
  LucideIcon,
  Header,
  Avatar,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { useAuth } from "../../store";
import { useLogout } from "../../hooks/useLogout";
import { tokenManager } from "@nks/mobile-utils";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

interface Store {
  id: number;
  storeName: string;
  storeCode: string;
  category?: string;
  isApproved: boolean;
  createdAt: string;
}

export function StoreListScreen() {
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const authState = useAuth();
  const user = authState.authResponse?.data?.user;
  const { logout } = useLogout();

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStores = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      // tokenManager.get() returns the current token synchronously
      const token = tokenManager.get();
      const response = await fetch(`${API_BASE}/store/my-stores`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const json = await response.json();
      if (json.status === "success") {
        setStores(json.data ?? []);
      } else {
        setError(json.message ?? "Failed to load stores");
      }
    } catch (e) {
      setError("Could not connect to server. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStores(true);
  };

  const handleSelectStore = (_store: Store) => {
    router.push("/(protected)/(workspace)/(app)/(store)/(dashboard)");
  };

  const handleCreateStore = () => {
    router.push("/(protected)/(workspace)/(app)/(store)/setup");
  };

  const headerRightElement = (
    <Row align="center" gap="medium">
      <LucideIcon name="Plus" size={24} color={theme.colorPrimary} />
      {/* <LucideIcon
        name="LogOut"
        size={18}
        color={theme.colorError}
        onPress={() => logout()}
      /> */}
    </Row>
  );

  const headerLeftElement = <Avatar initials={user?.name ?? "User"} />;

  return (
    <Container>
      {/* Header */}
      <Header
        title="Stores"
        leftElement={headerLeftElement}
        rightElement={headerRightElement}
      />

      {/* Content */}
      <Content>
        {loading ? (
          <CenteredView>
            <ActivityIndicator size="large" color={theme.colorPrimary} />
            <Typography.Caption type="secondary" style={{ marginTop: 12 }}>
              Loading your stores...
            </Typography.Caption>
          </CenteredView>
        ) : error ? (
          <CenteredView>
            <LucideIcon
              name="WifiOff"
              size={48}
              color={theme.colorTextSecondary}
            />
            <Typography.Body
              weight="semiBold"
              style={{ marginTop: 16, textAlign: "center" }}
            >
              {error}
            </Typography.Body>
            <RetryButton onPress={() => fetchStores()}>
              <Typography.Body color={theme.colorPrimary} weight="semiBold">
                Try Again
              </Typography.Body>
            </RetryButton>
          </CenteredView>
        ) : stores.length === 0 ? (
          <CenteredView>
            <EmptyCard gap="medium" align="center">
              <LucideIcon
                name="Store"
                size={52}
                color={theme.colorTextSecondary}
              />
              <Column gap="xxSmall" align="center">
                <Typography.Body weight="semiBold">
                  No stores yet
                </Typography.Body>
                <Typography.Caption
                  type="secondary"
                  style={{ textAlign: "center" }}
                >
                  Create your first store to start selling
                </Typography.Caption>
              </Column>
              <CreateButton onPress={handleCreateStore}>
                <Row gap="xSmall" align="center">
                  <LucideIcon name="Plus" size={18} color={theme.colorWhite} />
                  <Typography.Body color={theme.colorWhite} weight="semiBold">
                    Create Store
                  </Typography.Body>
                </Row>
              </CreateButton>
            </EmptyCard>
          </CenteredView>
        ) : (
          <FlatList
            data={stores}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colorPrimary}
              />
            }
            ListHeaderComponent={
              <SectionHeader>
                <Typography.Body weight="semiBold">Your Stores</Typography.Body>
                <AddButton onPress={handleCreateStore}>
                  <Row gap="xxSmall" align="center">
                    <LucideIcon
                      name="Plus"
                      size={16}
                      color={theme.colorPrimary}
                    />
                    <Typography.Caption
                      color={theme.colorPrimary}
                      weight="semiBold"
                    >
                      Add
                    </Typography.Caption>
                  </Row>
                </AddButton>
              </SectionHeader>
            }
            renderItem={({ item }) => (
              <StoreCard
                onPress={() => handleSelectStore(item)}
                activeOpacity={0.7}
              >
                <Row align="center" gap="medium">
                  <StoreIconBg>
                    <LucideIcon
                      name="Store"
                      size={22}
                      color={theme.colorPrimary}
                    />
                  </StoreIconBg>
                  <Column gap="xxSmall" style={{ flex: 1 }}>
                    <Typography.Body weight="semiBold">
                      {item.storeName}
                    </Typography.Body>
                    <Typography.Caption type="secondary">
                      {item.storeCode ?? "—"}
                      {item.category ? `  ·  ${item.category}` : ""}
                    </Typography.Caption>
                  </Column>
                  {item.isApproved ? (
                    <ApprovedBadge>
                      <Typography.Caption color="#16a34a" weight="semiBold">
                        Active
                      </Typography.Caption>
                    </ApprovedBadge>
                  ) : (
                    <PendingBadge>
                      <Typography.Caption color="#d97706" weight="semiBold">
                        Pending
                      </Typography.Caption>
                    </PendingBadge>
                  )}
                  <LucideIcon
                    name="ChevronRight"
                    size={18}
                    color={theme.colorTextSecondary}
                  />
                </Row>
              </StoreCard>
            )}
          />
        )}
      </Content>

      {/* Footer */}
      <Footer $bottomInset={insets.bottom}>
        <LogoutButton onPress={() => logout()}>
          <Row gap="xSmall" align="center">
            <LucideIcon name="LogOut" size={18} color={theme.colorError} />
            <Typography.Body color={theme.colorError} weight="semiBold">
              Sign out
            </Typography.Body>
          </Row>
        </LogoutButton>
      </Footer>
    </Container>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const Container = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const Content = styled.View`
  flex: 1;
  padding: ${({ theme }) => theme.sizing.xLarge}px;
`;

const CenteredView = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
`;

const EmptyCard = styled(Column)`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.xLarge}px;
  padding: ${({ theme }) => theme.sizing.xxLarge}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
  width: 100%;
`;

const CreateButton = styled.TouchableOpacity`
  background-color: ${({ theme }) => theme.colorPrimary};
  border-radius: ${({ theme }) => theme.borderRadius.medium}px;
  padding-top: ${({ theme }) => theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.small}px;
  padding-left: ${({ theme }) => theme.sizing.xLarge}px;
  padding-right: ${({ theme }) => theme.sizing.xLarge}px;
`;

const SectionHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.sizing.medium}px;
`;

const AddButton = styled.TouchableOpacity`
  padding-top: 4px;
  padding-bottom: 4px;
  padding-left: 10px;
  padding-right: 10px;
  border-radius: 20px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorPrimary};
`;

const StoreCard = styled.TouchableOpacity`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  padding-top: ${({ theme }) => theme.sizing.medium}px;
  padding-bottom: ${({ theme }) => theme.sizing.medium}px;
  padding-left: ${({ theme }) => theme.sizing.large}px;
  padding-right: ${({ theme }) => theme.sizing.large}px;
  margin-bottom: ${({ theme }) => theme.sizing.small}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
`;

const StoreIconBg = styled.View`
  width: 44px;
  height: 44px;
  border-radius: ${({ theme }) => theme.borderRadius.medium}px;
  background-color: ${({ theme }) => theme.colorPrimaryBg ?? "#eff6ff"};
  align-items: center;
  justify-content: center;
`;

const ApprovedBadge = styled.View`
  background-color: #dcfce7;
  border-radius: 20px;
  padding-left: 8px;
  padding-right: 8px;
  padding-top: 3px;
  padding-bottom: 3px;
`;

const PendingBadge = styled.View`
  background-color: #fef3c7;
  border-radius: 20px;
  padding-left: 8px;
  padding-right: 8px;
  padding-top: 3px;
  padding-bottom: 3px;
`;

const RetryButton = styled.TouchableOpacity`
  margin-top: 16px;
  padding-top: 10px;
  padding-bottom: 10px;
  padding-left: 24px;
  padding-right: 24px;
  border-radius: 8px;
  border-width: 1.5px;
  border-color: ${({ theme }) => theme.colorPrimary};
`;

const Footer = styled.View<{ $bottomInset: number }>`
  padding-bottom: ${({ theme, $bottomInset }) =>
    theme.sizing.large + $bottomInset}px;
  padding-top: ${({ theme }) => theme.sizing.medium}px;
  align-items: center;
`;

const LogoutButton = styled.TouchableOpacity`
  padding-top: ${({ theme }) => theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.small}px;
  padding-left: ${({ theme }) => theme.sizing.xLarge}px;
  padding-right: ${({ theme }) => theme.sizing.xLarge}px;
`;
