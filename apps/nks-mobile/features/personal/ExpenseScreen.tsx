import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlatList, View } from "react-native";
import styled from "styled-components/native";
import { Column, Row, Typography, LucideIcon } from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";

// Mock expense data
const mockExpenses = [
  {
    id: "1",
    category: "Food",
    amount: 450,
    date: "2024-03-20",
    description: "Lunch at restaurant",
  },
  {
    id: "2",
    category: "Transport",
    amount: 150,
    date: "2024-03-19",
    description: "Taxi fare",
  },
  {
    id: "3",
    category: "Shopping",
    amount: 2500,
    date: "2024-03-18",
    description: "Grocery shopping",
  },
  {
    id: "4",
    category: "Entertainment",
    amount: 800,
    date: "2024-03-17",
    description: "Movie tickets",
  },
];

const categoryIcons = {
  Food: "Utensils",
  Transport: "Car",
  Shopping: "ShoppingBag",
  Entertainment: "Music",
} as const;

export function ExpenseScreen() {
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();

  const totalExpense = mockExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const renderExpenseItem = ({ item }: { item: typeof mockExpenses[0] }) => {
    const iconName = categoryIcons[item.category as keyof typeof categoryIcons];

    return (
      <ExpenseItem>
        <Row gap="medium" align="center" flex={1}>
          <IconCircle>
            <LucideIcon
              name={iconName || "Wallet"}
              size={20}
              color={theme.colorPrimary}
            />
          </IconCircle>
          <Column flex={1} gap="xxSmall">
            <Typography.Body weight="semiBold">{item.category}</Typography.Body>
            <Typography.Caption type="secondary">
              {item.description}
            </Typography.Caption>
            <Typography.Caption type="secondary" style={{ fontSize: 11 }}>
              {new Date(item.date).toLocaleDateString()}
            </Typography.Caption>
          </Column>
          <Typography.Body weight="semiBold" color={theme.colorError}>
            ₹{item.amount}
          </Typography.Body>
        </Row>
      </ExpenseItem>
    );
  };

  return (
    <Container>
      <Header $topInset={insets.top}>
        <Row align="center" justify="space-between">
          <Column gap="xxSmall">
            <Typography.Caption color={theme.colorWhite} style={{ opacity: 0.8 }}>
              Total Expenses
            </Typography.Caption>
            <Typography.H4 weight="bold" color={theme.colorWhite}>
              ₹{totalExpense}
            </Typography.H4>
          </Column>
          <IconButton>
            <LucideIcon name="Plus" size={24} color={theme.colorWhite} />
          </IconButton>
        </Row>
      </Header>

      <Content>
        {mockExpenses.length > 0 ? (
          <>
            <SectionTitle>
              <Typography.Body weight="semiBold">Recent Expenses</Typography.Body>
            </SectionTitle>
            <FlatList
              data={mockExpenses}
              renderItem={renderExpenseItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <Separator />}
            />
          </>
        ) : (
          <EmptyState gap="medium" align="center">
            <LucideIcon
              name="PieChart"
              size={48}
              color={theme.colorTextSecondary}
            />
            <Column gap="xxSmall" align="center">
              <Typography.Body weight="semiBold">No expenses yet</Typography.Body>
              <Typography.Caption type="secondary">
                Add your first expense to get started
              </Typography.Caption>
            </Column>
          </EmptyState>
        )}
      </Content>
    </Container>
  );
}

const Container = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const Header = styled.View<{ $topInset: number }>`
  background-color: ${({ theme }) => theme.colorPrimary};
  padding-top: ${({ theme, $topInset }) => theme.sizing.large + $topInset}px;
  padding-bottom: ${({ theme }) => theme.sizing.large}px;
  padding-left: ${({ theme }) => theme.sizing.xLarge}px;
  padding-right: ${({ theme }) => theme.sizing.xLarge}px;
`;

const IconButton = styled.TouchableOpacity`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background-color: rgba(255, 255, 255, 0.2);
  align-items: center;
  justify-content: center;
`;

const Content = styled.View`
  flex: 1;
  padding-top: ${({ theme }) => theme.sizing.large}px;
  padding-left: ${({ theme }) => theme.sizing.large}px;
  padding-right: ${({ theme }) => theme.sizing.large}px;
`;

const SectionTitle = styled.View`
  margin-bottom: ${({ theme }) => theme.sizing.medium}px;
`;

const ExpenseItem = styled.View`
  padding: ${({ theme }) => theme.sizing.medium}px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  margin-bottom: ${({ theme }) => theme.sizing.medium}px;
`;

const IconCircle = styled.View`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: ${({ theme }) => theme.colorPrimaryBg};
  align-items: center;
  justify-content: center;
`;

const Separator = styled.View`
  height: 1px;
  background-color: ${({ theme }) => theme.colorBorderSecondary};
  margin-vertical: ${({ theme }) => theme.sizing.small}px;
`;

const EmptyState = styled(Column)`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.xLarge}px;
  padding: ${({ theme }) => theme.sizing.xxLarge}px;
  justify-content: center;
`;
