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
import { usePhoneAuth } from "./hooks/usePhoneAuth";
import {
  CARD_SHADOW,
  Container,
  KeyboardAvoiding,
  PageScroll,
  BrandHero,
  DecoRing1,
  DecoRing2,
  DecoRing3,
  DecoRing4,
  BrandMark,
  HeroText,
  FormCard,
  FormContent,
  ErrorBanner,
  ErrorText,
} from "./components/auth-screen-styles";

export function PhoneScreen() {
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const {
    phone,
    setPhone,
    dialCode,
    isFocused,
    setIsFocused,
    isLoading,
    canSubmit,
    errorMessage,
    handleSendOtp,
  } = usePhoneAuth();

  return (
    <Container>
      <KeyboardAvoiding behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <PageScroll
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Hero Section ─── */}
          <BrandHero $topInset={insets.top}>
            <DecoRing1 />
            <DecoRing2 />
            <DecoRing3 />
            <DecoRing4 />

            <Row gap="small" align="center">
              <BrandMark style={{ elevation: 4 }}>
                <LucideIcon name="Store" size={20} color={theme.colorPrimary} />
              </BrandMark>
              <Column gap={2}>
                <Typography.H5
                  weight="bold"
                  color={theme.colorWhite}
                  style={{ letterSpacing: 0.5 }}
                >
                  NKS
                </Typography.H5>
                <Typography.Caption
                  color={theme.colorWhite}
                  style={{ opacity: 0.8 }}
                >
                  Business Platform
                </Typography.Caption>
              </Column>
            </Row>

            <HeroText gap={8}>
              <Typography.H1
                weight="bold"
                color={theme.colorWhite}
                style={{ fontSize: 36, lineHeight: 42 }}
              >
                {`Welcome to\nNamma Kadai.`}
              </Typography.H1>
              <Typography.Body
                color={theme.colorWhite}
                style={{ opacity: 0.9, maxWidth: "80%" }}
              >
                Enter your mobile number to receive a 6-digit code.
              </Typography.Body>
            </HeroText>
          </BrandHero>

          {/* ─── Form Card ─── */}
          <FormCard $bottomInset={insets.bottom} style={CARD_SHADOW}>
            <FormContent gap="xLarge">
              <Column gap="small">
                <PhoneLabel>Mobile Number</PhoneLabel>
                <PhoneInputRow
                  $isFocused={isFocused}
                  $hasError={errorMessage !== null}
                >
                  <DialCodeBox>
                    <CountryFlag>🇮🇳</CountryFlag>
                    <Typography.Body weight="semiBold" color={theme.colorText}>
                      {dialCode}
                    </Typography.Body>
                  </DialCodeBox>

                  <PhoneInput
                    value={phone}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onChangeText={setPhone}
                    placeholder="Phone number"
                    placeholderTextColor={theme.colorTextTertiary}
                    keyboardType="phone-pad"
                    maxLength={10}
                    returnKeyType="done"
                    onSubmitEditing={handleSendOtp}
                    autoFocus
                  />
                </PhoneInputRow>

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
                  label="Send Verification Code"
                  size="xlg"
                  variant="primary"
                  onPress={handleSendOtp}
                  loading={isLoading}
                  disabled={!canSubmit}
                  style={{ borderRadius: 14 }}
                />
                <Row
                  gap={8}
                  align="center"
                  justify="center"
                  style={{ marginTop: 8 }}
                >
                  <LucideIcon
                    name="ShieldCheck"
                    size={14}
                    color={theme.colorTextTertiary}
                  />
                  <Typography.Caption
                    color={theme.colorTextTertiary}
                    style={{ fontWeight: "500" }}
                  >
                    Secure login via OTP
                  </Typography.Caption>
                </Row>
              </Column>
            </FormContent>

            <HelperText align="center">
              <Typography.Caption color={theme.colorTextTertiary}>
                By continuing, you agree to our{" "}
                <Typography.Caption
                  weight="semiBold"
                  color={theme.colorPrimary}
                  onPress={() => {
                    // TODO: Navigate to terms of service page
                  }}
                >
                  Terms of Service
                </Typography.Caption>
              </Typography.Caption>
            </HelperText>
          </FormCard>
        </PageScroll>
      </KeyboardAvoiding>
    </Container>
  );
}

// ─── Screen-specific Styled Components ────────────────────────────────────────

const PhoneLabel = styled(Typography.Caption)`
  margin-left: 3px;
  padding-bottom: 4px;
  color: ${({ theme }) => theme.colorTextSecondary};
  font-weight: 500;
`;

const PhoneInputRow = styled.View<{
  $isFocused?: boolean;
  $hasError?: boolean;
}>`
  flex-direction: row;
  align-items: center;
  border-width: 1.5px;
  border-color: ${({ theme, $isFocused, $hasError }) =>
    $hasError
      ? theme.colorError
      : $isFocused
        ? theme.colorPrimary
        : theme.colorBorder};
  border-radius: ${({ theme }) => theme.borderRadius.regular}px;
  background-color: ${({ theme, $isFocused }) =>
    $isFocused ? theme.colorBgLayout : theme.colorBgContainer};
  overflow: hidden;
  min-height: 56px;
`;

const DialCodeBox = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.sizing.xSmall}px;
  padding-left: ${({ theme }) => theme.sizing.small}px;
  padding-right: ${({ theme }) => theme.sizing.small}px;
  padding-top: ${({ theme }) => theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.small}px;
  border-right-width: 1px;
  border-right-color: ${({ theme }) => theme.colorBorderSecondary};
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const CountryFlag = styled.Text`
  font-size: 20px;
  line-height: 24px;
`;

const PhoneInput = styled.TextInput`
  flex: 1;
  padding-left: ${({ theme }) => theme.sizing.small}px;
  padding-right: ${({ theme }) => theme.sizing.small}px;
  padding-top: ${({ theme }) => theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.small}px;
  font-size: ${({ theme }) => theme.fontSize.regular}px;
  font-family: ${({ theme }) => theme.fontFamily.poppinsRegular};
  color: ${({ theme }) => theme.colorText};
`;

const HelperText = styled(Column)`
  margin-top: ${({ theme }) => theme.sizing.large}px;
  margin-bottom: ${({ theme }) => theme.sizing.medium}px;
`;
