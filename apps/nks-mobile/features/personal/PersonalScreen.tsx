import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import styled from "styled-components/native";
import {
  Column,
  Row,
  Typography,
  LucideIcon,
  Header,
  Button,
  MetricCard
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { useAuth } from "../../store";
import { useLogout } from "../../hooks/useLogout";
import { WelcomeBanner, ExpenseRow } from "./components";
import type { ExpenseItem } from "./components/ExpenseRow";

export function PersonalScreen() {
  const router = useRouter();
  const { theme } = useMobileTheme();
  const user = useAuth().authResponse?.data?.user;
  const { logout } = useLogout();

  const recentExpenses: ExpenseItem[] = [
    { id: 1, title: "Grocery Store", amount: "-₹1,250", category: "Food", date: "Today" },
    { id: 2, title: "Gas Station", amount: "-₹3,500", category: "Travel", date: "Yesterday" },
    { id: 3, title: "Subscription", amount: "-₹499", category: "Entertainment", date: "Mar 22" },
    { id: 4, title: "Salary Deposit", amount: "+₹45,000", category: "Income", date: "Mar 20" },
  ];

  const leftElement = (
    <LucideIcon name="User" size={24} color={theme.colorText} />
  );

  const rightElement = (
    <TouchableOpacity onPress={() => logout()}>
      <LucideIcon name="LogOut" size={20} color={theme.colorError} />
    </TouchableOpacity>
  );

  return (
    <ScreenContainer>
      <Header 
        title="Personal Workspace" 
        leftElement={leftElement}
        rightElement={rightElement}
      />
      
      <ScrollArea showsVerticalScrollIndicator={false}>
        <Column padding="large" gap="large">
          {/* Welcome Card */}
          <WelcomeBanner name={user?.name } />

          {/* Stat Cards */}
          <Row gap="medium">
            <MetricCard
              flex={1}
              label="Total Expenses"
              value="₹5,249"
              valueColor={theme.colorError}
              iconName="ArrowDownRight"
              iconColor={theme.colorError}
              trend="-12% from last month"
            />
            <MetricCard
              flex={1}
              label="Total Income"
              value="₹45,000"
              valueColor={theme.colorSuccess}
              iconName="ArrowUpRight"
              iconColor={theme.colorSuccess}
              trend="+5% from last month"
            />
          </Row>

          {/* Expense Table Section */}
          <Section gap="medium">
            <SectionHeader align="center" justify="space-between">
              <Typography.H5 weight="semiBold">Recent Transactions</Typography.H5>
              <Button size="sm" variant="text" label="View All" />
            </SectionHeader>

            <Table>
              {recentExpenses.map((item, index) => (
                <ExpenseRow
                  key={item.id}
                  item={item}
                  isLast={index === recentExpenses.length - 1}
                />
              ))}
            </Table>
          </Section>

          {/* Quick Actions */}
          <Section gap="medium">
            <Typography.H5 weight="semiBold">Quick Actions</Typography.H5>
            <Row gap="medium">
              <ActionButton flex={1}>
                <LucideIcon name="PlusCircle" size={24} color={theme.colorPrimary} />
                <Typography.Caption weight="semiBold" style={{ marginTop: 4 }}>Add Expense</Typography.Caption>
              </ActionButton>
              <ActionButton flex={1}>
                <LucideIcon name="PieChart" size={24} color={theme.colorPrimary} />
                <Typography.Caption weight="semiBold" style={{ marginTop: 4 }}>Reports</Typography.Caption>
              </ActionButton>
              <ActionButton flex={1}>
                <LucideIcon name="Settings" size={24} color={theme.colorPrimary} />
                <Typography.Caption weight="semiBold" style={{ marginTop: 4 }}>Settings</Typography.Caption>
              </ActionButton>
            </Row>
          </Section>

          {/* Debug Button (Dev Only) */}
          {__DEV__ && (
            <Section gap="medium">
              <ActionButton
                flex={1}
                onPress={() => router.push("/(protected)/(workspace)/(app)/(debug)/database")}
              >
                <LucideIcon name="Database" size={24} color={theme.colorWarning} />
                <Typography.Caption weight="semiBold" style={{ marginTop: 4, color: theme.colorWarning }}>
                  🔧 Database Debug
                </Typography.Caption>
              </ActionButton>
            </Section>
          )}
        </Column>
      </ScrollArea>
    </ScreenContainer>
  );
}

const ScreenContainer = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const ScrollArea = styled(ScrollView)`
  flex: 1;
`;

const TouchableOpacity = styled.TouchableOpacity``;

const WelcomeCard = styled.View`
  background-color: ${({ theme }) => theme.colorPrimary};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  padding: ${({ theme }) => theme.sizing.xLarge}px;
`;

const AvatarCircle = styled.View`
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background-color: ${({ theme }) => theme.colorWhite};
  align-items: center;
  justify-content: center;
`;

const Section = styled(Column)``;

const SectionHeader = styled(Row)``;

const Table = styled.View`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  overflow: hidden;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
`;

const TableRow = styled(Row)`
  padding: ${({ theme }) => theme.sizing.large}px;
`;

const IconBox = styled.View`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: ${({ theme }) => theme.colorBgLayout};
  align-items: center;
  justify-content: center;
`;

const ActionButton = styled.TouchableOpacity<{ flex: number }>`
  flex: ${({ flex }) => flex};
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.medium}px;
  padding: ${({ theme }) => theme.sizing.large}px;
  align-items: center;
  justify-content: center;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
`;
