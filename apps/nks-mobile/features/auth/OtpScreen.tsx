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
import { useOtpVerify } from "./hooks/useOtpVerify";

const CARD_SHADOW = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.08,
  shadowRadius: 20,
  elevation: 8,
} as const;

// ─── OTP Digit Cell ───────────────────────────────────────────────────────────

type OtpDigitCellProps = {
  value: string;
  hasError: boolean;
  isFocused: boolean;
  onChangeText: (t: string) => void;
  onKeyPress: (e: { nativeEvent: { key: string } }) => void;
  onFocus: () => void;
  onBlur: () => void;
  inputRef: (r: TextInput | null) => void;
};

function OtpDigitCell({
  value,
  hasError,
  isFocused,
  onChangeText,
  onKeyPress,
  onFocus,
  onBlur,
  inputRef,
}: OtpDigitCellProps) {
  const { theme } = useMobileTheme();
  return (
    <TextInput
      ref={inputRef}
      value={value}
      onChangeText={onChangeText}
      onKeyPress={onKeyPress}
      onFocus={onFocus}
      onBlur={onBlur}
      keyboardType="number-pad"
      maxLength={1}
      selectTextOnFocus
      caretHidden
      style={{
        width: "100%",
        height: "100%",
        textAlign: "center",
        fontSize: theme.fontSize.xLarge,
        fontFamily: theme.fontFamily.poppinsSemiBold,
        color: hasError ? theme.colorError : theme.colorText,
      }}
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  // Format: +919025863606 → +91****3606
  if (phone.length < 5) return phone;

  // Keep country code (+91) and last 4 digits visible
  const countryCode = phone.startsWith('+') ? phone.slice(0, 3) : ''; // +91
  const visibleDigits = phone.slice(-4); // 3606
  const hiddenDigits = phone.slice(countryCode.length, -4).replace(/\d/g, '*');

  return countryCode + hiddenDigits + visibleDigits;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OtpScreen() {
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // ✅ Use hook for OTP verification logic
  const {
    digits,
    focusedIndex,
    countdown,
    errorMessage,
    canVerify,
    isVerifying,
    isResending,
    handleDigitChange: hookHandleDigitChange,
    handleKeyPress: hookHandleKeyPress,
    handleVerify: hookHandleVerify,
    handleResend,
    setFocusedIndex,
    phone,
    OTP_LENGTH,
  } = useOtpVerify();

  // Handle digit change with ref focus management
  const handleDigitChange = (text: string, index: number) => {
    hookHandleDigitChange(text, index);
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle key press with ref focus management
  const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number) => {
    hookHandleKeyPress(e, index);
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Auto-focus first input on mount
  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, []);

  return (
    <Container>
      <KeyboardAvoiding behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <PageScroll
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Brand Hero ─── */}
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
                {"Verify\nAccount."}
              </Typography.H1>
              <Typography.Body
                color={theme.colorWhite}
                style={{ opacity: 0.9, maxWidth: "80%" }}
              >
                {`We've sent a code to +${maskPhone(phone ?? "")}`}
              </Typography.Body>
            </HeroText>
          </BrandHero>

          {/* ─── Form Card ─── */}
          <FormCard $bottomInset={insets.bottom} style={CARD_SHADOW}>
            <FormContent gap="xLarge">
              {/* ─── OTP Digit Boxes ─── */}
              <Column gap="medium">
                <OtpBoxRow>
                  {Array.from({ length: OTP_LENGTH }, (_, i) => (
                    <OtpBox
                      key={i}
                      $filled={digits[i] !== ""}
                      $isFocused={focusedIndex === i}
                      $hasError={errorMessage !== null}
                    >
                      <OtpDigitCell
                        value={digits[i]}
                        hasError={errorMessage !== null}
                        isFocused={focusedIndex === i}
                        onFocus={() => setFocusedIndex(i)}
                        onBlur={() => setFocusedIndex(null)}
                        onChangeText={(t) => handleDigitChange(t, i)}
                        onKeyPress={(e) => handleKeyPress(e, i)}
                        inputRef={(r) => {
                          inputRefs.current[i] = r;
                        }}
                      />
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
                onPress={() => canVerify && hookHandleVerify(digits.join(""))}
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
`;

const FormContent = styled(Column)``;

const OtpBoxRow = styled.View`
  flex-direction: row;
  gap: ${({ theme }) => theme.sizing.medium}px;
  justify-content: center;
  padding-left: ${({ theme }) => theme.sizing.large}px;
  padding-right: ${({ theme }) => theme.sizing.large}px;
`;

const OtpBox = styled.View<{
  $filled: boolean;
  $isFocused: boolean;
  $hasError: boolean;
}>`
  width: 60px;
  aspect-ratio: 1;
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  border-width: 1.5px;
  border-color: ${({ theme, $filled, $isFocused, $hasError }) => {
    if ($hasError) return theme.colorError;
    if ($isFocused) return theme.colorPrimary;
    if ($filled) return theme.colorPrimary;
    return theme.colorBorder;
  }};
  background-color: ${({ theme, $filled, $isFocused, $hasError }) => {
    if ($hasError) return theme.colorErrorBg;
    if ($isFocused || $filled) return theme.colorBgLayout;
    return theme.colorBgLayout; // Subtle background for empty slots
  }};
  align-items: center;
  justify-content: center;
  overflow: hidden;
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
