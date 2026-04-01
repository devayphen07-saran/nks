import { Platform, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useState } from "react";
import styled from "styled-components/native";
import {
  Button,
  Column,
  LucideIcon,
  Row,
  Typography,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { profileComplete } from "@nks/api-manager";
import { useRootDispatch, useAuth } from "../../store";

const CARD_SHADOW = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.08,
  shadowRadius: 20,
  elevation: 8,
} as const;

export function SetPasswordScreen() {
  const dispatch = useRootDispatch();
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const authState = useAuth();

  const [password, setPasswordValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (isLoading) return;
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setErrorMessage("Passwords do not match");
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const userName = authState.authResponse?.data?.user?.name || "User";
      const result = await dispatch(
        profileComplete({ bodyParam: { name: userName, password } }),
      );
      if (profileComplete.fulfilled.match(result)) {
        router.replace("/(protected)/(workspace)");
      } else {
        setErrorMessage(
          (result.payload as any)?.message ??
            "Failed to set password. Please try again.",
        );
      }
    } catch {
      setErrorMessage("Failed to set password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <KeyboardAvoiding behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <PageScroll
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Hero ─── */}
          <BrandHero $topInset={insets.top}>
            <DecoRing1 />
            <DecoRing2 />
            <Row gap="small" align="center">
              <BrandMark>
                <LucideIcon name="Store" size={20} color={theme.colorPrimary} />
              </BrandMark>
              <Column gap={2}>
                <Typography.H5 weight="bold" color={theme.colorWhite}>
                  NKS
                </Typography.H5>
                <Typography.Caption color={theme.colorWhite}>
                  Business Platform
                </Typography.Caption>
              </Column>
            </Row>
            <HeroText gap={6}>
              <Typography.H1 weight="bold" color={theme.colorWhite}>
                {"Set\nPassword."}
              </Typography.H1>
              <Typography.Body color={theme.colorWhite}>
                Secure your account with a password
              </Typography.Body>
            </HeroText>
          </BrandHero>

          {/* ─── Form Card ─── */}
          <FormCard $bottomInset={insets.bottom} style={CARD_SHADOW}>
            <FormContent gap="large">
              <Column gap="medium">
                {/* Password */}
                <Column gap="xSmall">
                  <FieldLabel>Password *</FieldLabel>
                  <PasswordRow>
                    <PasswordInput
                      value={password}
                      onChangeText={(t) => {
                        setErrorMessage(null);
                        setPasswordValue(t);
                      }}
                      placeholder="Min. 8 characters"
                      placeholderTextColor={theme.colorTextTertiary}
                      secureTextEntry={!showPassword}
                      returnKeyType="next"
                    />
                    <EyeButton onPress={() => setShowPassword((v) => !v)}>
                      <LucideIcon
                        name={showPassword ? "EyeOff" : "Eye"}
                        size={18}
                        color={theme.colorTextSecondary}
                      />
                    </EyeButton>
                  </PasswordRow>
                </Column>

                {/* Confirm */}
                <Column gap="xSmall">
                  <FieldLabel>Confirm Password *</FieldLabel>
                  <PasswordRow>
                    <PasswordInput
                      value={confirm}
                      onChangeText={(t) => {
                        setErrorMessage(null);
                        setConfirm(t);
                      }}
                      placeholder="Re-enter password"
                      placeholderTextColor={theme.colorTextTertiary}
                      secureTextEntry={!showConfirm}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                    />
                    <EyeButton onPress={() => setShowConfirm((v) => !v)}>
                      <LucideIcon
                        name={showConfirm ? "EyeOff" : "Eye"}
                        size={18}
                        color={theme.colorTextSecondary}
                      />
                    </EyeButton>
                  </PasswordRow>
                </Column>

                {errorMessage !== null && (
                  <ErrorBanner gap="xSmall" align="center">
                    <LucideIcon
                      name="AlertCircle"
                      size={14}
                      color={theme.colorError}
                    />
                    <ErrorText weight="medium">{errorMessage}</ErrorText>
                  </ErrorBanner>
                )}
              </Column>

              <Column gap="small">
                <Button
                  label="Set Password"
                  size="xlg"
                  variant="primary"
                  onPress={handleSubmit}
                  loading={isLoading}
                />
                <SkipButton
                  onPress={() => router.replace("/(protected)/(workspace)")}
                >
                  <Typography.Body
                    weight="semiBold"
                    color={theme.colorTextSecondary}
                  >
                    Skip for now
                  </Typography.Body>
                </SkipButton>
              </Column>
            </FormContent>
          </FormCard>
        </PageScroll>
      </KeyboardAvoiding>
    </Container>
  );
}

// ─── Styled Components ────────────────────────────────────────────────────────

const Container = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgContainer};
`;

const KeyboardAvoiding = styled(KeyboardAvoidingView)`
  flex: 1;
`;

const PageScroll = styled.ScrollView`
  flex: 1;
`;

const BrandHero = styled.View<{ $topInset: number }>`
  background-color: ${({ theme }) => theme.colorPrimary};
  padding-top: ${({ $topInset, theme }) => $topInset + theme.sizing.large}px;
  padding-left: ${({ theme }) => theme.sizing.xLarge}px;
  padding-right: ${({ theme }) => theme.sizing.xLarge}px;
  padding-bottom: ${({ theme }) => theme.sizing.xLarge * 2 + 8}px;
  overflow: hidden;
  justify-content: space-between;
  min-height: 220px;
`;

const DecoRing1 = styled.View`
  position: absolute;
  width: 220px;
  height: 220px;
  border-radius: 110px;
  border-width: 1.5px;
  border-color: ${({ theme }) => theme.colorWhite};
  opacity: 0.1;
  top: -70px;
  right: -50px;
`;

const DecoRing2 = styled.View`
  position: absolute;
  width: 130px;
  height: 130px;
  border-radius: 65px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorWhite};
  opacity: 0.07;
  bottom: 40px;
  left: -20px;
`;

const BrandMark = styled.View`
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.borderRadius.regular}px;
  background-color: ${({ theme }) => theme.colorWhite};
  align-items: center;
  justify-content: center;
`;

const HeroText = styled(Column)`
  margin-top: ${({ theme }) => theme.sizing.xLarge}px;
`;

const FormCard = styled(Column)<{ $bottomInset: number }>`
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-top-left-radius: ${({ theme }) => theme.borderRadius.xxLarge}px;
  border-top-right-radius: ${({ theme }) => theme.borderRadius.xxLarge}px;
  padding-left: ${({ theme }) => theme.sizing.xLarge}px;
  padding-right: ${({ theme }) => theme.sizing.xLarge}px;
  padding-top: ${({ theme }) => theme.sizing.xLarge}px;
  padding-bottom: ${({ theme, $bottomInset }) =>
    theme.sizing.medium + $bottomInset}px;
  margin-top: -${({ theme }) => theme.borderRadius.xxLarge}px;
  flex: 1;
  justify-content: space-between;
`;

const FormContent = styled(Column)``;

const FieldLabel = styled(Typography.Caption)`
  margin-left: 3px;
  padding-bottom: 4px;
  color: ${({ theme }) => theme.colorTextSecondary};
  font-weight: 500;
`;

const PasswordRow = styled.View`
  flex-direction: row;
  align-items: center;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorder};
  border-radius: ${({ theme }) => theme.borderRadius.regular}px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  overflow: hidden;
`;

const PasswordInput = styled.TextInput`
  flex: 1;
  padding-left: ${({ theme }) => theme.sizing.small}px;
  padding-right: ${({ theme }) => theme.sizing.small}px;
  padding-top: ${({ theme }) => theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.small}px;
  font-size: ${({ theme }) => theme.fontSize.regular}px;
  font-family: ${({ theme }) => theme.fontFamily.poppinsRegular};
  color: ${({ theme }) => theme.colorText};
`;

const EyeButton = styled.TouchableOpacity`
  padding-left: ${({ theme }) => theme.sizing.small}px;
  padding-right: ${({ theme }) => theme.sizing.small}px;
  padding-top: ${({ theme }) => theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.small}px;
`;

const ErrorBanner = styled(Row)`
  background-color: ${({ theme }) => theme.colorErrorBg};
  border-radius: ${({ theme }) => theme.borderRadius.regular}px;
  padding-left: ${({ theme }) => theme.sizing.small}px;
  padding-right: ${({ theme }) => theme.sizing.small}px;
  padding-top: ${({ theme }) => theme.sizing.xSmall}px;
  padding-bottom: ${({ theme }) => theme.sizing.xSmall}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorErrorBorder};
`;

const ErrorText = styled(Typography.Caption)`
  color: ${({ theme }) => theme.colorErrorText};
  flex: 1;
`;

const SkipButton = styled.TouchableOpacity`
  align-items: center;
  padding-top: ${({ theme }) => theme.sizing.xSmall}px;
  padding-bottom: ${({ theme }) => theme.sizing.xSmall}px;
`;
