import { Platform, KeyboardAvoidingView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef, useCallback } from "react";
import styled from "styled-components/native";
import {
  sendOtp,
  verifyOtp,
  type RequestParams,
  type SendOtpRequest,
  type VerifyOtpRequest,
} from "@nks/api-manager";
import {
  Button,
  Column,
  LucideIcon,
  Row,
  Typography,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { useRootDispatch } from "../../store";
import { persistLogin } from "../../store/persistLogin";

const OTP_LENGTH = 4;
const RESEND_COOLDOWN = 30;

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
  if (phone.length < 5) return phone;
  const visible = phone.slice(-4);
  const masked = phone.slice(0, phone.length - 4).replace(/\d/g, "*");
  return masked + visible;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OtpScreen() {
  const dispatch = useRootDispatch();
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const { phone, reqId: initialReqId } = useLocalSearchParams<{
    phone: string;
    reqId: string;
  }>();
  const [reqId, setReqId] = useState(initialReqId ?? "");

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    startCountdown();
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
    return () => clearTimer();
  }, []);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startCountdown = () => {
    clearTimer();
    setCountdown(RESEND_COOLDOWN);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerify = useCallback(
    async (otpValue: string) => {
      if (isVerifying) return;
      setErrorMessage(null);
      setIsVerifying(true);
      try {
        const verifyParams: RequestParams<VerifyOtpRequest> = {
          bodyParam: { phone: phone ?? "", otp: otpValue, reqId },
        };
        const result = await dispatch(verifyOtp(verifyParams));
        if (verifyOtp.fulfilled.match(result)) {
          await persistLogin(result.payload.data, dispatch);
          router.replace("/(protected)/(workspace)/(onboarding)/account-type");
        } else {
          setErrorMessage(
            (result.payload as any)?.message ??
              "Invalid OTP. Please try again.",
          );
          setDigits(Array(OTP_LENGTH).fill(""));
          setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
      } catch {
        setErrorMessage("Verification failed. Please try again.");
        setDigits(Array(OTP_LENGTH).fill(""));
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      } finally {
        setIsVerifying(false);
      }
    },
    [dispatch, isVerifying, phone, reqId],
  );

  const handleDigitChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setErrorMessage(null);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newDigits.every((d) => d !== "")) {
      handleVerify(newDigits.join(""));
    }
  };

  const handleKeyPress = (
    e: { nativeEvent: { key: string } },
    index: number,
  ) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (isResending || countdown > 0) return;
    setIsResending(true);
    setErrorMessage(null);
    setDigits(Array(OTP_LENGTH).fill(""));
    try {
      const resendParams: RequestParams<SendOtpRequest> = {
        bodyParam: { phone: phone ?? "" },
      };
      const result = await dispatch(sendOtp(resendParams));
      if (sendOtp.fulfilled.match(result)) {
        setReqId(result.payload?.data?.message ?? "");
        startCountdown();
      } else {
        setErrorMessage("Failed to resend OTP. Please try again.");
      }
    } catch {
      setErrorMessage("Failed to resend OTP. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  const canVerify = digits.every((d) => d !== "") && !isVerifying;

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
                onPress={() => canVerify && handleVerify(digits.join(""))}
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
