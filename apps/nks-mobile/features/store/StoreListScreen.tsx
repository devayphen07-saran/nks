import React, { useState, useCallback } from "react";
import {
  ListRenderItem,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { router, useNavigation } from "expo-router";
import { DrawerActions } from "@react-navigation/native";
import styled from "styled-components/native";
import {
  Avatar,
  IconButton,
  LucideIcon,
  Row,
  SearchInput,
  Typography,
  FlatListScaffold,
  Header,
  Column,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { useAuth } from "../../store";
import {
  HeaderControls,
  SearchRow,
  FilterRow,
  FilterButton,
  FilterButtonText,
  LoadingCard,
} from "../shared/list-screen-styles";

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
  const authState = useAuth();
  const user = authState.authResponse?.user;
  const navigation = useNavigation();

  // TODO: Connect to store state from Redux or API
  const myStores: Store[] = [];
  const invitedStores: Store[] = [];
  const myStoresLoading = false;
  const invitedStoresLoading = false;

  const [filter, setFilter] = useState<"all" | "own" | "invited">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleAvatarPress = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  // TODO: Dispatch getMyStores and getInvitedStores API calls on mount

  const displayStores =
    filter === "all"
      ? [...myStores, ...invitedStores]
      : filter === "own"
        ? myStores
        : invitedStores;

  const isLoading =
    filter === "all"
      ? myStoresLoading || invitedStoresLoading
      : filter === "own"
        ? myStoresLoading
        : invitedStoresLoading;

  const handleSelectStore = useCallback(
    async (store: Store) => {
      // TODO: Dispatch storeSelect API call
      console.log("Selecting store:", store.id);
      router.replace("/(protected)/(workspace)/(app)/(store)/store");
    },
    [],
  );

  const handleCreateStore = useCallback(() => {
    router.push("/(protected)/(workspace)/(app)/(store)/setup");
  }, []);

  const filteredStores = displayStores.filter(
    (s: any) =>
      s.storeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.storeCode?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const renderItem: ListRenderItem<Store> = useCallback(
    ({ item }) => (
      <StoreCard onPress={() => handleSelectStore(item)} activeOpacity={0.7}>
        <Row align="center" gap="medium">
          <StoreIconBg>
            <LucideIcon name="Store" size={22} color={theme.colorPrimary} />
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
    ),
    [theme],
  );

  return (
    <StoreScreenContainer>
      <Header
        title="Stores"
        leftElement={
          <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.7}>
            <Avatar initials={user?.name ?? "U"} size={36} />
          </TouchableOpacity>
        }
        rightElement={
          <IconButton
            iconName="Plus"
            size={36}
            variant="secondary"
            onPress={handleCreateStore}
          />
        }
      />

      <HeaderControls>
        <SearchRow>
          <SearchInput
            placeholder="Search stores..."
            style={{ flex: 1 }}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <IconButton
            size={40}
            variant="secondary"
            iconElement={<LucideIcon name="SlidersHorizontal" />}
          />
        </SearchRow>

        <FilterRow>
          <FilterButton
            active={filter === "all"}
            onPress={() => setFilter("all")}
          >
            <FilterButtonText active={filter === "all"}>All</FilterButtonText>
          </FilterButton>
          <FilterButton
            active={filter === "own"}
            onPress={() => setFilter("own")}
          >
            <FilterButtonText active={filter === "own"}>
              My Stores
            </FilterButtonText>
          </FilterButton>
          <FilterButton
            active={filter === "invited"}
            onPress={() => setFilter("invited")}
          >
            <FilterButtonText active={filter === "invited"}>
              Staff
            </FilterButtonText>
          </FilterButton>
        </FilterRow>
      </HeaderControls>

      <FlatListScaffold
        data={filteredStores}
        renderItem={renderItem}
        listProps={{
          refetch: () => {
            // TODO: Dispatch getMyStores and getInvitedStores API calls
            console.log("Refetching stores...");
          },
          addNew: handleCreateStore,
        }}
        loaderProps={{
          isLoading: isLoading,
          isFetching: false,
          loaderLength: 5,
          loadingCard: (
            <LoadingCard>
              <ActivityIndicator color={theme.colorPrimary} />
            </LoadingCard>
          ),
        }}
      />
    </StoreScreenContainer>
  );
}

const StoreScreenContainer = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const StoreCard = styled.TouchableOpacity`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  padding: ${({ theme }) => theme.sizing.large}px;
  margin-bottom: ${({ theme }) => theme.sizing.small}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
`;

const StoreIconBg = styled.View`
  width: 44px;
  height: 44px;
  border-radius: ${({ theme }) => theme.borderRadius.medium}px;
  background-color: ${({ theme }) => theme.colorPrimaryBg};
  align-items: center;
  justify-content: center;
`;

const ApprovedBadge = styled.View`
  background-color: #dcfce7;
  border-radius: 20px;
  padding: 3px 8px;
`;

const PendingBadge = styled.View`
  background-color: #fef3c7;
  border-radius: 20px;
  padding: 3px 8px;
`;

