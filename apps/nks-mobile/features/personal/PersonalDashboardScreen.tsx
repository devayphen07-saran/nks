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
import { useAuth } from "../../store";

interface Expense {
  id: number;
  description: string;
  amount: number;
  category: string;
  date: string;
}

export function PersonalDashboardScreen() {
  const { theme } = useMobileTheme();
  const user = useAuth().authResponse?.user;
  const navigation = useNavigation();

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "food" | "transport">("all");

  // Mock expenses data
  const expenses: Expense[] = [
    { id: 1, description: "Lunch", amount: 450, category: "Food", date: "2024-03-28" },
    { id: 2, description: "Fuel", amount: 2000, category: "Transport", date: "2024-03-27" },
    { id: 3, description: "Movie", amount: 500, category: "Entertainment", date: "2024-03-26" },
    { id: 4, description: "Groceries", amount: 1200, category: "Food", date: "2024-03-25" },
  ];

  const handleAvatarPress = useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);

  const filteredExpenses = expenses.filter(
    (e) => {
      const matchesSearch = e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.category?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filter === "all" || e.category.toLowerCase() === filter;
      return matchesSearch && matchesFilter;
    }
  );

  const renderItem: ListRenderItem<Expense> = useCallback(
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
            <LoadingCard>
              <ActivityIndicator color={theme.colorPrimary} />
            </LoadingCard>
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

const HeaderControls = styled.View`
  background-color: ${({ theme }) => theme.colorBgContainer};
  padding: ${({ theme }) => theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.medium}px;
  border-bottom-width: 1px;
  border-bottom-color: ${({ theme }) => theme.colorBorderSecondary};
  gap: ${({ theme }) => theme.sizing.small}px;
  z-index: 10;
`;

const SearchRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.sizing.small}px;
`;

const FilterRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.sizing.xSmall}px;
`;

const FilterButton = styled.TouchableOpacity<{ active: boolean }>`
  background-color: ${({ theme, active }) =>
    active ? theme.colorPrimary : theme.colorBgLayout};
  border-radius: 20px;
  padding: 6px 14px;
  border-width: 1px;
  border-color: ${({ theme, active }) =>
    active ? theme.colorPrimary : theme.colorBorderSecondary};
`;

const FilterButtonText = styled(Typography.Caption)<{ active: boolean }>`
  color: ${({ active, theme }) =>
    active ? theme.colorWhite : theme.colorTextSecondary};
  font-weight: ${({ active }) => (active ? "700" : "500")};
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

const LoadingCard = styled.View`
  height: 80px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  margin-bottom: ${({ theme }) => theme.sizing.small}px;
  align-items: center;
  justify-content: center;
  margin-left: ${({ theme }) => theme.sizing.large}px;
  margin-right: ${({ theme }) => theme.sizing.large}px;
`;
