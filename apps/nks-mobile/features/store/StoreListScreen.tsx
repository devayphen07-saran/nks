import React, { useState, useCallback, useEffect } from "react";
import {
  ListRenderItem,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { router, useNavigation } from "expo-router";
import { ROUTES } from "../../lib/navigation/routes";
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
import { setActiveStore } from "@nks/state-manager";
import { useRootDispatch, useAuthState } from "../../store";
import { getMyStores } from "@nks/api-manager";
import {
  HeaderControls,
  SearchRow,
  FilterRow,
  FilterButton,
  FilterButtonText,
  LoadingCard,
} from "../shared/list-screen-styles";
import { handleError } from "../../shared/errors";

interface Store {
  id: number;
  guuid: string;
  storeName: string;
  storeCode: string | null;
  isApproved: boolean;
  isOwner: boolean;
  createdAt: string;
}

export function StoreListScreen() {
  const { theme } = useMobileTheme();
  const dispatch = useRootDispatch();
  const authState = useAuthState();
  const user = authState.authResponse?.user;
  const navigation = useNavigation();

  const [myStores, setMyStores] = useState<Store[]>([]);
  const [invitedStores, setInvitedStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "own" | "invited">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleAvatarPress = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  const fetchStores = useCallback(() => {
    setIsLoading(true);
    setFetchError(null);
    dispatch(getMyStores({}))
      .unwrap()
      .then((res) => {
        const data = res?.data;
        setMyStores(data?.myStores ?? []);
        setInvitedStores(data?.invitedStores ?? []);
      })
      .catch((err) => {
        const appError = handleError(err, { action: "fetch_stores" });
        setFetchError(appError.getUserMessage());
      })
      .finally(() => setIsLoading(false));
  }, [dispatch]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const displayStores =
    filter === "all"
      ? [...myStores, ...invitedStores]
      : filter === "own"
        ? myStores
        : invitedStores;

  const filteredStores = displayStores.filter(
    (s) =>
      s.storeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.storeCode?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSelectStore = useCallback((store: Store) => {
    dispatch(setActiveStore({ guuid: store.guuid, name: store.storeName }));
    router.replace(ROUTES.STORE_HOME);
  }, [dispatch]);

  const handleCreateStore = useCallback(() => {
    router.push("/(protected)/(store)/setup");
  }, []);

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
            </Typography.Caption>
          </Column>
          {item.isApproved ? (
            <ApprovedBadge>
              <Typography.Caption color={theme.colorSuccess} weight="semiBold">
                Active
              </Typography.Caption>
            </ApprovedBadge>
          ) : (
            <PendingBadge>
              <Typography.Caption color={theme.colorWarning} weight="semiBold">
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
    [theme, handleSelectStore],
  );

  return (
    <StoreScreenContainer>
      <Header
        title="Stores"
        leftElement={
          <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.7}>
            <Avatar initials={(user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "") || "U"} size={36} />
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

      {fetchError && (
        <ErrorBanner>
          <Typography.Caption color={theme.colorError}>{fetchError}</Typography.Caption>
        </ErrorBanner>
      )}

      <FlatListScaffold
        data={filteredStores}
        renderItem={renderItem}
        listProps={{
          refetch: fetchStores,
          addNew: handleCreateStore,
        }}
        loaderProps={{
          isLoading,
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
  background-color: ${({ theme }) => theme.colorSuccessBg};
  border-radius: 20px;
  padding: 3px 8px;
`;

const PendingBadge = styled.View`
  background-color: ${({ theme }) => theme.colorWarningBg};
  border-radius: 20px;
  padding: 3px 8px;
`;

const ErrorBanner = styled.View`
  background-color: ${({ theme }) => theme.colorErrorBg};
  padding: 10px 16px;
  margin: 0 0 8px 0;
`;
