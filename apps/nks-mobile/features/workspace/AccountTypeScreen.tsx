import { router } from "expo-router";
import { Platform, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback } from "react";
import styled from "styled-components/native";
import {
  Alert,
  Column,
  LucideIcon,
  Row,
  Typography,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { useRootDispatch } from "../../store";
import { logoutThunk } from "../../store/logoutThunk";

export function AccountTypeScreen() {
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useRootDispatch();

  const handleStore = useCallback(() => {
    // Go directly to the store list — profile completion is not required
    router.push("/(protected)/(workspace)/(app)/(store)/list");
  }, []);


  const handlePersonal = useCallback(() => {
    router.push("/(protected)/(workspace)/(app)/(personal)/dashboard");
  }, []);

  const handleLogout = useCallback(() => {
    Alert.confirm(
      "Logout",
      "Are you sure you want to log out?",
      () => dispatch(logoutThunk()),
      "Logout",
      "destructive"
    );
  }, [dispatch]);

  return (
    <Container>
      <KeyboardAvoiding behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollArea
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <Hero $topInset={insets.top}>
            <DecorRingTopRight />
            <DecorRingBottomLeft />
            <HeroContent align="center" gap="xSmall">
              <LogoCircle>
                <LucideIcon name="Store" size={36} color={theme.colorPrimary} />
              </LogoCircle>
              <Typography.H3 weight="bold" color={theme.colorWhite}>
                NKS
              </Typography.H3>
              <Typography.Body color={theme.colorWhite}>
                How will you use NKS?
              </Typography.Body>
            </HeroContent>
          </Hero>

          <FormCard
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.12,
              shadowRadius: 24,
              elevation: 8,
            }}
          >
            <FormHeader gap="xxSmall">
              <Typography.H4 weight="bold">Choose account type</Typography.H4>
              <Typography.Body type="secondary">
                Select how you want to use the platform
              </Typography.Body>
            </FormHeader>

            <Column gap="small">
              <OptionCard onPress={handleStore}>
                <Row gap="medium" align="center">
                  <IconBox>
                    <LucideIcon
                      name="Store"
                      size={28}
                      color={theme.colorPrimary}
                    />
                  </IconBox>
                  <Column flex={1} gap="xxSmall">
                    <Typography.Body weight="semiBold">
                      Store / Business
                    </Typography.Body>
                    <Typography.Caption type="secondary">
                      Manage inventory, orders, and staff
                    </Typography.Caption>
                  </Column>
                  <LucideIcon
                    name="ChevronRight"
                    size={20}
                    color={theme.colorTextSecondary}
                  />
                </Row>
              </OptionCard>

              <OptionCard onPress={handlePersonal}>
                <Row gap="medium" align="center">
                  <IconBox>
                    <LucideIcon
                      name="User"
                      size={28}
                      color={theme.colorPrimary}
                    />
                  </IconBox>
                  <Column flex={1} gap="xxSmall">
                    <Typography.Body weight="semiBold">
                      Personal
                    </Typography.Body>
                    <Typography.Caption type="secondary">
                      Track personal expenses and purchases
                    </Typography.Caption>
                  </Column>
                  <LucideIcon
                    name="ChevronRight"
                    size={20}
                    color={theme.colorTextSecondary}
                  />
                </Row>
              </OptionCard>
            </Column>
          </FormCard>

          <Column flex={1} justify="flex-end" align="center" padding="xLarge" gap="medium">
            <InviteLink
              onPress={() => router.push("/(protected)/(workspace)/(onboarding)/accept-invite")}
            >
              <Typography.Body weight="semiBold" type="primary">
                Have an invite token? Join a store
              </Typography.Body>
            </InviteLink>

            <LogoutButton onPress={handleLogout}>
              <Row gap="xSmall" align="center">
                <LucideIcon name="LogOut" size={18} color={theme.colorTextTertiary} />
                <Typography.Body weight="medium" color={theme.colorTextTertiary}>
                  Logout
                </Typography.Body>
              </Row>
            </LogoutButton>
          </Column>
        </ScrollArea>
      </KeyboardAvoiding>
    </Container>
  );
}

// ─── Styled Components ────────────────────────────────────────────────────────

const Container = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorPrimary};
`;

const KeyboardAvoiding = styled(KeyboardAvoidingView)`
  flex: 1;
`;

const ScrollArea = styled.ScrollView`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const Hero = styled.View<{ $topInset: number }>`
  background-color: ${({ theme }) => theme.colorPrimary};
  padding-top: ${({ theme, $topInset }) => theme.sizing.xLarge + $topInset}px;
  padding-bottom: ${({ theme }) =>
    theme.sizing.xxLarge + theme.sizing.xLarge}px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const DecorRingTopRight = styled.View`
  position: absolute;
  width: 240px;
  height: 240px;
  border-radius: 120px;
  border-width: 40px;
  border-color: ${({ theme }) => theme.colorWhite};
  opacity: 0.07;
  top: -80px;
  right: -60px;
`;

const DecorRingBottomLeft = styled.View`
  position: absolute;
  width: 160px;
  height: 160px;
  border-radius: 80px;
  border-width: 30px;
  border-color: ${({ theme }) => theme.colorWhite};
  opacity: 0.07;
  bottom: -50px;
  left: -30px;
`;

const HeroContent = styled(Column)``;

const LogoCircle = styled.View`
  width: 80px;
  height: 80px;
  border-radius: 40px;
  background-color: ${({ theme }) => theme.colorWhite};
  align-items: center;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.sizing.xSmall}px;
`;

const FormCard = styled(Column)`
  margin-left: ${({ theme }) => theme.sizing.medium}px;
  margin-right: ${({ theme }) => theme.sizing.medium}px;
  margin-top: -${({ theme }) => theme.sizing.xLarge}px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.xLarge}px;
  padding: ${({ theme }) => theme.sizing.xLarge}px;
`;

const FormHeader = styled(Column)`
  margin-bottom: ${({ theme }) => theme.sizing.large}px;
`;

const OptionCard = styled.TouchableOpacity`
  background-color: ${({ theme }) => theme.colorBgLayout};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  padding: ${({ theme }) => theme.sizing.medium}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
`;

const IconBox = styled.View`
  width: 52px;
  height: 52px;
  border-radius: ${({ theme }) => theme.borderRadius.medium}px;
  background-color: ${({ theme }) => theme.colorPrimaryBg};
  align-items: center;
  justify-content: center;
`;

const InviteLink = styled.TouchableOpacity`
  padding-top: ${({ theme }) => theme.sizing.xxSmall}px;
  padding-bottom: ${({ theme }) => theme.sizing.xxSmall}px;
`;

const LogoutButton = styled.TouchableOpacity`
  padding-top: ${({ theme }) => theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.small}px;
  margin-bottom: ${({ theme }) => theme.sizing.medium}px;
`;
