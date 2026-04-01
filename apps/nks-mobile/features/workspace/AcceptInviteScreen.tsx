import { router } from "expo-router";
import { Platform, KeyboardAvoidingView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback, useState } from "react";
import styled from "styled-components/native";
import {
  Alert,
  Column,
  LucideIcon,
  Row,
  Typography,
  Button,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { useRootDispatch } from "../../store";
import { acceptInvite } from "@nks/api-manager";
import { refreshSession } from "../../store/refreshSession";

export function AcceptInviteScreen() {
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useRootDispatch();
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAccept = useCallback(async () => {
    if (!token.trim()) {
      setError("Please enter a valid invite token");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await dispatch(
        acceptInvite({ bodyParam: { token: token.trim() } }),
      );

      if (result.meta.requestStatus === "fulfilled") {
        await dispatch(refreshSession());
        router.replace("/(protected)/(workspace)/(app)/(store)/list");
      } else {
        setError(
          "Failed to accept invite. Please check the token and try again.",
        );
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, token]);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

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
                  <LucideIcon
                    name="Layers"
                    size={24}
                    color={theme.colorWhite}
                  />
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
                <LucideIcon
                  name="Link"
                  size={12}
                  color={theme.colorTextSecondary}
                />
                <Typography.Caption
                  weight="semiBold"
                  color={theme.colorTextSecondary}
                >
                  ACCEPT INVITE
                </Typography.Caption>
              </SetupBadge>
              <Typography.H2 weight="bold">
                Join an{"\n"}organization
              </Typography.H2>
              <Typography.Body type="secondary">
                Enter the invite token provided by your organization admin to
                get started.
              </Typography.Body>
            </Column>

            <FormCard gap="large">
              <Column gap="small">
                <Typography.Body weight="semiBold" color={theme.colorText}>
                  Invite Token
                </Typography.Body>

                {error && (
                  <ErrorText>
                    <LucideIcon
                      name="AlertCircle"
                      size={14}
                      color={theme.colorError}
                    />
                    <Typography.Caption color={theme.colorError}>
                      {error}
                    </Typography.Caption>
                  </ErrorText>
                )}
              </Column>

              <Button
                onPress={handleAccept}
                disabled={isLoading || !token.trim()}
                loading={isLoading}
              >
                {isLoading ? "Accepting..." : "Accept Invite"}
              </Button>

              <BackButton onPress={handleBack} disabled={isLoading}>
                <Typography.Body color={theme.colorTextSecondary}>
                  Back
                </Typography.Body>
              </BackButton>
            </FormCard>
          </PageContent>
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

const FormCard = styled(Column)`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  padding: ${({ theme }) => theme.sizing.large}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
`;

const StyledTextInput = styled(TextInput)`
  background-color: ${({ theme }) => theme.colorBgLayout};
  border-radius: ${({ theme }) => theme.borderRadius.medium}px;
  padding: ${({ theme }) => theme.sizing.medium}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
  color: ${({ theme }) => theme.colorText};
  font-size: 14px;
  min-height: 100px;
`;

const ErrorText = styled(Row)`
  align-items: center;
  gap: ${({ theme }) => theme.sizing.small}px;
`;

const BackButton = styled.TouchableOpacity<{ disabled: boolean }>`
  padding-top: ${({ theme }) => theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.small}px;
  align-items: center;
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
`;
