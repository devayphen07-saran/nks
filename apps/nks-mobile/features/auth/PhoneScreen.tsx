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
import {
  sendOtp,
  type RequestParams,
  type SendOtpRequest,
} from "@nks/api-manager";
import { useRootDispatch } from "../../store";

const COUNTRY_CODE = "91";

const CARD_SHADOW = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.08,
  shadowRadius: 20,
  elevation: 8,
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function PhoneScreen() {
  const dispatch = useRootDispatch();
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSendOtp = async () => {
    if (isLoading) return;
    const digits = phone.trim();
    if (digits.length !== 10) {
      setErrorMessage("Enter a valid 10-digit mobile number");
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const fullPhone = COUNTRY_CODE + digits;
      const params: RequestParams<SendOtpRequest> = {
        bodyParam: { phone: fullPhone },
      };
      const result = await dispatch(sendOtp(params));
      if (sendOtp.fulfilled.match(result)) {
        const reqId = result.payload?.data?.message ?? "";
        router.push({
          pathname: "/(auth)/otp",
          params: { phone: fullPhone, reqId },
        });
      } else {
        setErrorMessage(
          (result.payload as any)?.message ??
            "Failed to send OTP. Please try again."
        );
      }
    } catch {
      setErrorMessage("Failed to send OTP. Please try again.");
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
                {"Welcome to\nNamma Kadai."}
              </Typography.H1>
              <Typography.Body
                color={theme.colorWhite}
                style={{ opacity: 0.9, maxWidth: "80%" }}
              >
                Enter your mobile number to receive a 4-digit code.
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
                  <CountryCodeBadge>
                    <Typography.Body weight="semiBold" color={theme.colorText}>
                      🇮🇳 +91
                    </Typography.Body>
                  </CountryCodeBadge>
                  <PhoneInput
                    value={phone}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onChangeText={(t) => {
                      setErrorMessage(null);
                      setPhone(t.replace(/[^0-9]/g, "").slice(0, 10));
                    }}
                    placeholder="98765 43210"
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
                  style={{ borderRadius: 14 }}
                />
                <InfoRow gap={8} align="center" justify="center" style={{ marginTop: 8 }}>
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
                </InfoRow>
              </Column>
            </FormContent>

            <HelperText align="center">
              <Typography.Caption color={theme.colorTextTertiary}>
                By continuing, you agree to our{" "}
                <Typography.Caption
                  weight="semiBold"
                  color={theme.colorPrimary}
                  onPress={() => {}}
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

const PhoneLabel = styled(Typography.Caption)`
  margin-left: 3px;
  padding-bottom: 4px;
  color: ${({ theme }) => theme.colorTextSecondary};
  font-weight: 500;
`;

const PhoneInputRow = styled.View<{ $isFocused?: boolean; $hasError?: boolean }>`
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

const CountryCodeBadge = styled.View`
  padding-left: ${({ theme }) => theme.sizing.small}px;
  padding-right: ${({ theme }) => theme.sizing.small}px;
  padding-top: ${({ theme }) => theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.small}px;
  border-right-width: 1px;
  border-right-color: ${({ theme }) => theme.colorBorderSecondary};
  background-color: ${({ theme }) => theme.colorBgLayout};
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

const InfoRow = styled(Row)``;

const HelperText = styled(Column)`
  margin-top: ${({ theme }) => theme.sizing.large}px;
  margin-bottom: ${({ theme }) => theme.sizing.medium}px;
`;
