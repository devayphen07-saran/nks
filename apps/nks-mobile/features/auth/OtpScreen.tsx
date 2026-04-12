import { Platform, KeyboardAvoidingView, TextInput } from "react-native";
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

const CARD_SHADOW = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.08,
  shadowRadius: 20,
  elevation: 8,
} as const;

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

const DecoRing3 = styled.View`
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 150px;
  background-color: ${({ theme }) => theme.colorWhite};
  opacity: 0.03;
  top: -100px;
  left: -100px;
`;

const DecoRing4 = styled.View`
  position: absolute;
  width: 180px;
  height: 180px;
  border-radius: 90px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorWhite};
  opacity: 0.05;
  bottom: -40px;
  right: 20px;
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
  position: relative;
`;

const FormContent = styled(Column)``;

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
