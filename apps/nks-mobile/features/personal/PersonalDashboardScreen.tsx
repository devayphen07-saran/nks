import { useSafeAreaInsets } from "react-native-safe-area-context";
import styled from "styled-components/native";
import { Column, Row, Typography, LucideIcon } from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { useAuth } from "../../store";

export function PersonalDashboardScreen() {
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const user = useAuth().authResponse?.data?.user;

  // Mock dashboard data
  const totalExpenses = 4800;
  const monthlyBudget = 10000;
  const spentPercentage = (totalExpenses / monthlyBudget) * 100;
  const topExpenseCategory = "Food";

  return (
    <Container>
      <Header $topInset={insets.top}>
        <Row align="center" justify="space-between">
          <Column gap="xxSmall">
            <Typography.Caption color={theme.colorWhite} style={{ opacity: 0.8 }}>
              Welcome back
            </Typography.Caption>
            <Typography.H4 weight="bold" color={theme.colorWhite}>
              {user?.name ?? "User"}
            </Typography.H4>
          </Column>
          <AvatarCircle>
            <Typography.Body weight="bold" color={theme.colorPrimary}>
              {user?.name?.[0]?.toUpperCase() ?? "U"}
            </Typography.Body>
          </AvatarCircle>
        </Row>
      </Header>

      <Content>
        {/* Budget Overview Card */}
        <Card>
          <Column gap="large">
            <Column gap="small">
              <Row align="center" justify="space-between">
                <Column gap="xxSmall">
                  <Typography.Caption type="secondary">
                    Monthly Budget
                  </Typography.Caption>
                  <Typography.H3 weight="bold">₹{monthlyBudget}</Typography.H3>
                </Column>
                <IconCircle bgColor={theme.colorPrimaryBg}>
                  <LucideIcon
                    name="PieChart"
                    size={28}
                    color={theme.colorPrimary}
                  />
                </IconCircle>
              </Row>
            </Column>

            {/* Progress Bar */}
            <Column gap="small">
              <Row align="center" justify="space-between">
                <Typography.Caption type="secondary">
                  Spent this month
                </Typography.Caption>
                <Typography.Caption weight="semiBold">
                  {spentPercentage.toFixed(0)}%
                </Typography.Caption>
              </Row>
              <ProgressBarContainer>
                <ProgressBar
                  $progress={spentPercentage}
                  $color={
                    spentPercentage > 80
                      ? theme.colorError
                      : spentPercentage > 50
                      ? theme.colorWarning
                      : theme.colorSuccess
                  }
                />
              </ProgressBarContainer>
              <Typography.Caption type="secondary">
                ₹{totalExpenses} of ₹{monthlyBudget}
              </Typography.Caption>
            </Column>
          </Column>
        </Card>

        {/* Stats Grid */}
        <StatsGrid>
          <StatCard>
            <Column gap="medium" align="center">
              <IconCircle bgColor={theme.colorErrorBg}>
                <LucideIcon
                  name="TrendingUp"
                  size={24}
                  color={theme.colorError}
                />
              </IconCircle>
              <Column gap="xxSmall" align="center">
                <Typography.Caption type="secondary">
                  Total Spent
                </Typography.Caption>
                <Typography.Body weight="semiBold">
                  ₹{totalExpenses}
                </Typography.Body>
              </Column>
            </Column>
          </StatCard>

          <StatCard>
            <Column gap="medium" align="center">
              <IconCircle bgColor={theme.colorSuccessBg}>
                <LucideIcon
                  name="Zap"
                  size={24}
                  color={theme.colorSuccess}
                />
              </IconCircle>
              <Column gap="xxSmall" align="center">
                <Typography.Caption type="secondary">
                  Remaining
                </Typography.Caption>
                <Typography.Body weight="semiBold">
                  ₹{monthlyBudget - totalExpenses}
                </Typography.Body>
              </Column>
            </Column>
          </StatCard>
        </StatsGrid>

        {/* Top Category */}
        <Card>
          <Column gap="medium">
            <Row align="center" justify="space-between">
              <Typography.Body weight="semiBold">Top Category</Typography.Body>
              <LucideIcon
                name="ChevronRight"
                size={20}
                color={theme.colorTextSecondary}
              />
            </Row>
            <Row align="center" gap="medium">
              <IconCircle bgColor={theme.colorPrimaryBg}>
                <LucideIcon
                  name="Utensils"
                  size={24}
                  color={theme.colorPrimary}
                />
              </IconCircle>
              <Column flex={1} gap="xxSmall">
                <Typography.Body weight="semiBold">
                  {topExpenseCategory}
                </Typography.Body>
                <Typography.Caption type="secondary">
                  ₹1200 • 5 transactions
                </Typography.Caption>
              </Column>
            </Row>
          </Column>
        </Card>
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

const AvatarCircle = styled.View`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background-color: ${({ theme }) => theme.colorWhite};
  align-items: center;
  justify-content: center;
`;

const Content = styled.ScrollView`
  flex: 1;
  padding: ${({ theme }) => theme.sizing.large}px;
`;

const Card = styled.View`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.xLarge}px;
  padding: ${({ theme }) => theme.sizing.large}px;
  margin-bottom: ${({ theme }) => theme.sizing.large}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
`;

const IconCircle = styled.View<{ bgColor: string }>`
  width: 52px;
  height: 52px;
  border-radius: 26px;
  background-color: ${({ bgColor }) => bgColor};
  align-items: center;
  justify-content: center;
`;

const ProgressBarContainer = styled.View`
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background-color: ${({ theme }) => theme.colorBgLayout};
  overflow: hidden;
`;

const ProgressBar = styled.View<{ $progress: number; $color: string }>`
  width: ${({ $progress }) => Math.min($progress, 100)}%;
  height: 100%;
  background-color: ${({ $color }) => $color};
  border-radius: 4px;
`;

const StatsGrid = styled.View`
  flex-direction: row;
  gap: ${({ theme }) => theme.sizing.medium}px;
  margin-bottom: ${({ theme }) => theme.sizing.large}px;
`;

const StatCard = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.xLarge}px;
  padding: ${({ theme }) => theme.sizing.large}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
  align-items: center;
`;
