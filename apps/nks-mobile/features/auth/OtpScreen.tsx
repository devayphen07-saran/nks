import { Platform, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import styled from "styled-components/native";
import {
  Button,
  Column,
  LucideIcon,
  Row,
  Typography,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { maskPhone } from "@nks/utils";
import { useOtpVerify } from "./hooks/useOtpVerify";
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
  FormCard as BaseFormCard,
  FormContent,
  ErrorBanner,
  ErrorText,
} from "./components/auth-screen-styles";

// ─── Component ────────────────────────────────────────────────────────────────

export function OtpScreen() {
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const hiddenInputRef = useRef<TextInput>(null);

  const {
    digits,
    countdown,
    errorMessage,
    canVerify,
    isVerifying,
    isResending,
    setOtpFromString,
    handleVerify,
    handleResend,
    phone,
    OTP_LENGTH,
  } = useOtpVerify();

  // Auto-focus hidden input on mount
  useEffect(() => {
    const timer = setTimeout(() => hiddenInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  // Clear + refocus after failed verification
  useEffect(() => {
    if (errorMessage && digits.every((d) => d === "")) {
      const timer = setTimeout(() => {
        if (hiddenInputRef.current) {
          hiddenInputRef.current.clear();
          hiddenInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, digits]);

  const otpString = digits.join("");

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
                <Typography.Caption color={theme.colorWhite} style={{ opacity: 0.8 }}>
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
                {`Verify\nAccount.`}
              </Typography.H1>
              <Typography.Body
                color={theme.colorWhite}
                style={{ opacity: 0.9, maxWidth: "80%" }}
              >
                {`We've sent a code to ${maskPhone(phone ?? "")}`}
              </Typography.Body>
            </HeroText>
          </BrandHero>

          {/* ─── Form Card ─── */}
          <FormCard $bottomInset={insets.bottom} style={CARD_SHADOW}>
            <FormContent gap="xLarge">
              {/* ─── Hidden Input (Source of Truth) ─── */}
              <HiddenInputContainer>
                <HiddenInput
                  ref={hiddenInputRef}
                  onChangeText={setOtpFromString}
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  placeholder=""
                  textAlign="center"
                  caretHidden
                  autoFocus
                />
              </HiddenInputContainer>

              {/* ─── OTP Display Boxes ─── */}
              <Column gap="medium">
                <OtpBoxRow>
                  {Array.from({ length: OTP_LENGTH }, (_, i) => (
                    <OtpBox
                      key={i}
                      $filled={digits[i] !== ""}
                      $hasError={errorMessage !== null}
                      onPress={() => hiddenInputRef.current?.focus()}
                    >
                      <OtpDigit weight="semiBold" color={theme.colorText}>
                        {digits[i]}
                      </OtpDigit>
                    </OtpBox>
                  ))}
                </OtpBoxRow>

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

              {/* ─── Resend ─── */}
              <ResendRow gap={6} align="center" justify="center">
                <Typography.Body color={theme.colorTextSecondary}>
                  Didn't receive the OTP?
                </Typography.Body>
                {countdown > 0 ? (
                  <Column
                    align="center"
                    justify="center"
                    style={{ minWidth: 100 }}
                  >
                    <Typography.Body
                      weight="semiBold"
                      color={theme.colorTextSecondary}
                    >
                      Resend in {countdown}s
                    </Typography.Body>
                  </Column>
                ) : (
                  <ResendButton onPress={handleResend} disabled={isResending}>
                    <Typography.Body weight="bold" color={theme.colorPrimary}>
                      {isResending ? "Sending…" : "Resend OTP"}
                    </Typography.Body>
                  </ResendButton>
                )}
              </ResendRow>

              {/* ─── Verify Button ─── */}
              <Button
                label="Verify & Continue"
                size="xlg"
                variant="primary"
                onPress={() => canVerify && handleVerify(otpString)}
                loading={isVerifying}
                disabled={!canVerify}
                style={{ borderRadius: 14 }}
              />
            </FormContent>

            <CardFooter align="center" justify="center">
              <Row gap={6} align="center">
                <Typography.Body color={theme.colorTextSecondary}>
                  Wrong number?
                </Typography.Body>
                <BackLink onPress={() => router.back()}>
                  <Typography.Body weight="bold" color={theme.colorPrimary}>
                    Change number
                  </Typography.Body>
                </BackLink>
              </Row>
            </CardFooter>
          </FormCard>
        </PageScroll>
      </KeyboardAvoiding>
    </Container>
  );
}

// ─── Screen-specific Styled Components ────────────────────────────────────────

// FormCard with position: relative for the hidden input overlay
const FormCard = styled(BaseFormCard)`
  position: relative;
`;

// ─── Hidden Input (Production-Standard Pattern) ───
const HiddenInputContainer = styled.View`
  position: absolute;
  width: 100%;
  height: 56px;
  top: 0;
  left: 0;
  opacity: 0;
  z-index: 10;
`;

const HiddenInput = styled(TextInput)`
  flex: 1;
  font-size: 24px;
  color: transparent;
`;

const OtpBoxRow = styled.View`
  flex-direction: row;
  gap: ${({ theme }) => theme.sizing.xxSmall}px;
  justify-content: center;
  padding-left: ${({ theme }) => theme.sizing.xxSmall}px;
  padding-right: ${({ theme }) => theme.sizing.xxSmall}px;
`;

const OtpBox = styled.TouchableOpacity<{
  $filled: boolean;
  $hasError: boolean;
}>`
  width: 56px;
  height: 56px;
  border-radius: 14px;
  border-width: 2px;
  border-color: ${({ theme, $filled, $hasError }) => {
    if ($hasError) return theme.colorError;
    if ($filled) return theme.colorPrimary;
    return "#E5E5E5";
  }};
  background-color: ${({ theme, $filled, $hasError }) => {
    if ($hasError) return "#FFF1F1";
    if ($filled) return "#F5F7FF";
    return "#FFFFFF";
  }};
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const OtpDigit = styled(Typography.H3)`
  font-size: 24px;
  color: ${({ theme }) => theme.colorText};
`;

const ResendRow = styled(Row)``;

const ResendButton = styled.TouchableOpacity`
  padding-top: ${({ theme }) => theme.sizing.xxSmall}px;
  padding-bottom: ${({ theme }) => theme.sizing.xxSmall}px;
`;

const CardFooter = styled(Column)`
  padding-top: ${({ theme }) => theme.sizing.medium}px;
  border-top-width: 1px;
  border-top-color: ${({ theme }) => theme.colorBorderSecondary};
`;

const BackLink = styled.TouchableOpacity`
  padding-top: ${({ theme }) => theme.sizing.xxSmall}px;
  padding-bottom: ${({ theme }) => theme.sizing.xxSmall}px;
`;
