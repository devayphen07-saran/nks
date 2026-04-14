import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import styled from "styled-components/native";
import {
  Button,
  Column,
  LucideIcon,
  Row,
  Typography,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { useSetPassword } from "./hooks/useSetPassword";
import {
  CARD_SHADOW,
  Container,
  KeyboardAvoiding,
  PageScroll,
  BrandHero,
  DecoRing1,
  DecoRing2,
  BrandMark,
  HeroText,
  FormCard,
  FormContent,
  ErrorBanner,
  ErrorText,
} from "./components/auth-screen-styles";

export function SetPasswordScreen() {
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();

  // ✅ Use hook for password setup logic
  const {
    password,
    setPassword,
    confirm,
    setConfirm,
    showPassword,
    setShowPassword,
    showConfirm,
    setShowConfirm,
    isLoading,
    errorMessage,
    handleSubmit,
    handleSkip,
  } = useSetPassword();

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
                      onChangeText={setPassword}
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
                      onChangeText={setConfirm}
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
                <SkipButton onPress={handleSkip}>
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

// ─── Screen-specific Styled Components ────────────────────────────────────────

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

const SkipButton = styled.TouchableOpacity`
  align-items: center;
  padding-top: ${({ theme }) => theme.sizing.xSmall}px;
  padding-bottom: ${({ theme }) => theme.sizing.xSmall}px;
`;
