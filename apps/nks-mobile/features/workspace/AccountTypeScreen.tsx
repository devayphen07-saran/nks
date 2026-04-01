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
import { setupPersonal } from "@nks/api-manager";
import { refreshSession } from "../../store/refreshSession";

export function AccountTypeScreen() {
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useRootDispatch();

  const handleStore = useCallback(() => {
    router.push("/(protected)/(workspace)/(app)/(store)/list");
  }, []);

  const handlePersonal = useCallback(() => {
    dispatch(setupPersonal({})).then(() => {
      dispatch(refreshSession()).then(() => {
        router.push("/(protected)/(workspace)/(app)/(personal)/dashboard");
      });
    });
  }, [dispatch]);

  const handleLogout = useCallback(() => {
    Alert.confirm(
      "Logout",
      "Are you sure you want to log out?",
      () => dispatch(logoutThunk()),
      "Logout",
      "destructive",
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
            <HeroContent gap="xSmall" align="center">
              <LogoRow gap="small" align="center">
                <LogoCircle>
                  <LucideIcon name="Layers" size={24} color={theme.colorWhite} />
                </LogoCircle>
                <Typography.H4 weight="bold" color={theme.colorText}>
                  NKS
                </Typography.H4>
              </LogoRow>
            </HeroContent>
          </Hero>

          <PageContent gap="large">
            <Column gap="medium">
              <SetupBadge>
                <LucideIcon name="Settings" size={12} color={theme.colorTextSecondary} />
                <Typography.Caption weight="semiBold" color={theme.colorTextSecondary}>
                  ACCOUNT SETUP
                </Typography.Caption>
              </SetupBadge>
              <Typography.H2 weight="bold">Select your{"\n"}workspace</Typography.H2>
              <Typography.Body type="secondary">
                Choose the account type that best matches your operational requirements.
              </Typography.Body>
            </Column>

            <Column gap="medium">
              <OptionCard onPress={handleStore}>
                <Row gap="medium" align="center">
                  <IconBoxPrimary>
                    <LucideIcon name="Building2" size={28} color={theme.colorWhite} />
                  </IconBoxPrimary>
                  <Column flex={1} gap="xxSmall">
                    <Typography.Body weight="semiBold">Business Account</Typography.Body>
                    <Typography.Caption type="secondary">
                      Comprehensive tools to manage inventory, process orders, and collaborate with your team.
                    </Typography.Caption>
                  </Column>
                  <LucideIcon name="ChevronRight" size={20} color={theme.colorTextSecondary} />
                </Row>
              </OptionCard>

              <OptionCard onPress={handlePersonal}>
                <Row gap="medium" align="center">
                  <IconBoxSecondary>
                    <LucideIcon name="User" size={28} color={theme.colorTextSecondary} />
                  </IconBoxSecondary>
                  <Column flex={1} gap="xxSmall">
                    <Typography.Body weight="semiBold">Personal Account</Typography.Body>
                    <Typography.Caption type="secondary">
                      Simplified experience to track individual expenses and manage personal purchases.
                    </Typography.Caption>
                  </Column>
                  <LucideIcon name="ChevronRight" size={20} color={theme.colorTextSecondary} />
                </Row>
              </OptionCard>
            </Column>
          </PageContent>

          <BottomSection gap="medium">
            <InviteLinkCard
              onPress={() =>
                router.push(
                  "/(protected)/(workspace)/(app)/(onboarding)/accept-invite",
                )
              }
            >
              <Row gap="medium" align="center" style={{ flex: 1 }}>
                <LucideIcon
                  name="Link"
                  size={24}
                  color={theme.colorTextSecondary}
                />
                <Column flex={1} gap="xxSmall">
                  <Typography.Body weight="semiBold" color={theme.colorText}>
                    Have an invite link?
                  </Typography.Body>
                  <Typography.Caption color={theme.colorTextSecondary}>
                    Join an existing organization team
                  </Typography.Caption>
                </Column>
                <LucideIcon
                  name="ChevronRight"
                  size={20}
                  color={theme.colorTextSecondary}
                />
              </Row>
            </InviteLinkCard>

            <SignOutButton onPress={handleLogout}>
              <Typography.Body color={theme.colorTextSecondary}>
                Sign out securely
              </Typography.Body>
            </SignOutButton>
          </BottomSection>
        </ScrollArea>
      </KeyboardAvoiding>
    </Container>
  );
}

// ─── Styled Components ────────────────────────────────────────────────────────

const Container = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const KeyboardAvoiding = styled(KeyboardAvoidingView)`
  flex: 1;
`;

const ScrollArea = styled.ScrollView`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const Hero = styled.View<{ $topInset: number }>`
  background-color: ${({ theme }) => theme.colorBgLayout};
  padding-top: ${({ theme, $topInset }) => theme.sizing.medium + $topInset}px;
  padding-bottom: ${({ theme }) => theme.sizing.medium}px;
  padding-left: ${({ theme }) => theme.sizing.large}px;
  padding-right: ${({ theme }) => theme.sizing.large}px;
  align-items: flex-start;
  justify-content: flex-start;
  overflow: hidden;
`;

const HeroContent = styled(Column)``;

const LogoRow = styled(Row)`
  align-self: flex-start;
`;

const LogoCircle = styled.View`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background-color: ${({ theme }) => theme.colorPrimary};
  align-items: center;
  justify-content: center;
`;

const PageContent = styled(Column)`
  padding-left: ${({ theme }) => theme.sizing.large}px;
  padding-right: ${({ theme }) => theme.sizing.large}px;
  padding-top: ${({ theme }) => theme.sizing.medium}px;
  padding-bottom: ${({ theme }) => theme.sizing.large}px;
`;

const SetupBadge = styled(Row)`
  background-color: ${({ theme }) => theme.colorBgLayout};
  border-radius: 20px;
  padding-left: ${({ theme }) => theme.sizing.small}px;
  padding-right: ${({ theme }) => theme.sizing.small}px;
  padding-top: ${({ theme }) => theme.sizing.xxSmall}px;
  padding-bottom: ${({ theme }) => theme.sizing.xxSmall}px;
  align-self: flex-start;
  gap: ${({ theme }) => theme.sizing.xxSmall}px;
`;

const OptionCard = styled.TouchableOpacity`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  padding: ${({ theme }) => theme.sizing.large}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
`;


const IconBoxPrimary = styled.View`
  width: 52px;
  height: 52px;
  border-radius: ${({ theme }) => theme.borderRadius.medium}px;
  background-color: ${({ theme }) => theme.colorPrimary};
  align-items: center;
  justify-content: center;
`;

const IconBoxSecondary = styled.View`
  width: 52px;
  height: 52px;
  border-radius: ${({ theme }) => theme.borderRadius.medium}px;
  background-color: ${({ theme }) => theme.colorBgLayout};
  align-items: center;
  justify-content: center;
`;

const BottomSection = styled(Column)`
  margin-left: ${({ theme }) => theme.sizing.large}px;
  margin-right: ${({ theme }) => theme.sizing.large}px;
  margin-top: ${({ theme }) => theme.sizing.large}px;
  margin-bottom: ${({ theme }) => theme.sizing.large}px;
`;

const InviteLinkCard = styled.TouchableOpacity`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  padding: ${({ theme }) => theme.sizing.large}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
`;


const SignOutButton = styled.TouchableOpacity`
  padding-top: ${({ theme }) => theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.small}px;
  align-items: center;
`;
