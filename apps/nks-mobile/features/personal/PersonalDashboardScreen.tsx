import React, { useCallback, useState } from "react";
import { TouchableOpacity, ActivityIndicator, ListRenderItem } from "react-native";
import { useNavigation } from "expo-router";
import { DrawerActions } from "@react-navigation/native";
import styled from "styled-components/native";
import {
  Avatar,
  LucideIcon,
  Row,
  SearchInput,
  Typography,
  FlatListScaffold,
  Header,
  Column,
  IconButton,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { useAuthState } from "../../store";
import {
  HeaderControls,
  SearchRow,
  FilterRow,
  FilterButton,
  FilterButtonText,
  LoadingCardInset,
} from "../shared/list-screen-styles";
// TODO: Replace with Redux thunk dispatching to the transactions API
interface MockExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
}
const MOCK_EXPENSES: MockExpense[] = [];

export function PersonalDashboardScreen() {
  const { theme } = useMobileTheme();
  const user = useAuthState().authResponse?.user;
  const navigation = useNavigation();

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "food" | "transport">("all");

  const handleAvatarPress = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  const filteredExpenses = MOCK_EXPENSES.filter(
    (e: MockExpense) => {
      const matchesSearch = e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.category?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filter === "all" || e.category.toLowerCase() === filter;
      return matchesSearch && matchesFilter;
    }
  );

  const renderItem: ListRenderItem<MockExpense> = useCallback(
    ({ item }) => (
      <ExpenseCard activeOpacity={0.7}>
        <Row align="center" gap="medium">
          <CategoryIconBg>
            <LucideIcon name="Wallet" size={22} color={theme.colorPrimary} />
          </CategoryIconBg>
          <Column gap="xxSmall" style={{ flex: 1 }}>
            <Typography.Body weight="semiBold">
              {item.description}
            </Typography.Body>
            <Typography.Caption type="secondary">
              {item.category}  ·  {item.date}
            </Typography.Caption>
          </Column>
          <Column gap="xxSmall" align="flex-end">
            <Typography.Body weight="semiBold">
              ₹{item.amount}
            </Typography.Body>
          </Column>
          <LucideIcon
            name="ChevronRight"
            size={18}
            color={theme.colorTextSecondary}
          />
        </Row>
      </ExpenseCard>
    ),
    [theme],
  );

  return (
    <ContainerContainer>
      <Header
        title="Personal"
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
            onPress={() => {}}
          />
        }
      />

      <HeaderControls>
        <SearchRow>
          <SearchInput
            placeholder="Search expenses..."
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
            active={filter === "food"}
            onPress={() => setFilter("food")}
          >
            <FilterButtonText active={filter === "food"}> Food </FilterButtonText>
          </FilterButton>
          <FilterButton
            active={filter === "transport"}
            onPress={() => setFilter("transport")}
          >
            <FilterButtonText active={filter === "transport"}>
              Transport
            </FilterButtonText>
          </FilterButton>
        </FilterRow>
      </HeaderControls>

      <FlatListScaffold
        data={filteredExpenses}
        renderItem={renderItem}
        listProps={{
          refetch: () => {
            setSearchQuery("");
            setFilter("all");
          },
          addNew: () => {},
        }}
        loaderProps={{
          isLoading: false,
          isFetching: false,
          loaderLength: 5,
          loadingCard: (
            <LoadingCardInset>
              <ActivityIndicator color={theme.colorPrimary} />
            </LoadingCardInset>
          ),
        }}
      />
    </ContainerContainer>
  );
}

const ContainerContainer = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const ExpenseCard = styled.TouchableOpacity`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  padding: ${({ theme }) => theme.sizing.large}px;
  margin-bottom: ${({ theme }) => theme.sizing.small}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
  margin-left: ${({ theme }) => theme.sizing.large}px;
  margin-right: ${({ theme }) => theme.sizing.large}px;
`;

const CategoryIconBg = styled.View`
  width: 44px;
  height: 44px;
  border-radius: ${({ theme }) => theme.borderRadius.medium}px;
  background-color: ${({ theme }) => theme.colorPrimaryBg};
  align-items: center;
  justify-content: center;
`;

