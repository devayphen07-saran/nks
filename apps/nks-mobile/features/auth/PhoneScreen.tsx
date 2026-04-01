import {
  Platform,
  KeyboardAvoidingView,
  Modal,
  FlatList,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useState, useEffect } from "react";
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
  getPublicDialCodes,
} from "@nks/api-manager";
import { useRootDispatch } from "../../store";

// Country data type (matches backend response)
interface Country {
  id: number;
  countryName: string;
  isoCode2: string;
  dialCode: string;
  currencyCode: string;
  currencySymbol: string;
  timezone: string;
  isActive?: boolean;
}

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
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(true);

  // Fetch countries on component mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        // Use api-manager thunk to fetch public dial codes (no auth required)
        const result = await dispatch(getPublicDialCodes({}));

        if (getPublicDialCodes.fulfilled.match(result)) {
          const data = result.payload?.data as Country[];
          if (data && Array.isArray(data)) {
            // Filter to show only active countries (extra safety - backend already filters)
            const activeCountries = data.filter((c) => c.isActive !== false);
            setCountries(activeCountries);

            // Default to India if available, else first active country
            const india = activeCountries.find((c) => c.isoCode2 === "IN");
            setSelectedCountry(india || activeCountries[0]);
          }
        } else {
          // Fallback on error
          throw new Error("Failed to fetch countries");
        }
      } catch (error) {
        console.error("Failed to fetch countries:", error);
        // Fallback to India
        setSelectedCountry({
          id: 1,
          countryName: "India",
          isoCode2: "IN",
          dialCode: "+91",
          currencyCode: "INR",
          currencySymbol: "₹",
          timezone: "Asia/Kolkata",
          isActive: true,
        });
      } finally {
        setCountriesLoading(false);
      }
    };

    loadCountries();
  }, [dispatch]);

  const handleSendOtp = async () => {
    if (isLoading || !selectedCountry) return;
    const digits = phone.trim();

    // Validate phone number (basic check - country-specific validation can be added later)
    if (digits.length < 9 || digits.length > 15) {
      setErrorMessage("Enter a valid mobile number");
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    try {
      // Combine dial code with phone number (remove leading + if present)
      const dialCode = selectedCountry.dialCode.replace(/\D/g, "");
      const fullPhone = "+" + dialCode + digits;

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
            "Failed to send OTP. Please try again.",
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
                  <CountryCodeButton
                    onPress={() => setShowCountryPicker(true)}
                    disabled={countriesLoading}
                  >
                    <CountryCodeContent>
                      <CountryFlag>
                        {getCountryFlag(selectedCountry?.isoCode2)}
                      </CountryFlag>
                      <Typography.Body
                        weight="semiBold"
                        color={theme.colorText}
                      >
                        {selectedCountry?.dialCode || "+91"}
                      </Typography.Body>
                      <DropdownIcon>
                        <LucideIcon
                          name="ChevronDown"
                          size={16}
                          color={theme.colorTextSecondary}
                        />
                      </DropdownIcon>
                    </CountryCodeContent>
                  </CountryCodeButton>

                  <PhoneInput
                    value={phone}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onChangeText={(t) => {
                      setErrorMessage(null);
                      setPhone(t.replace(/[^0-9]/g, "").slice(0, 15));
                    }}
                    placeholder="Phone number"
                    placeholderTextColor={theme.colorTextTertiary}
                    keyboardType="phone-pad"
                    maxLength={15}
                    returnKeyType="done"
                    onSubmitEditing={handleSendOtp}
                    autoFocus
                  />
                </PhoneInputRow>

                {/* Country Picker Modal */}
                <Modal
                  visible={showCountryPicker}
                  transparent
                  animationType="slide"
                  onRequestClose={() => setShowCountryPicker(false)}
                >
                  <CountryPickerContainer>
                    <CountryPickerHeader>
                      <Typography.H5 weight="bold" color={theme.colorText}>
                        Select Country
                      </Typography.H5>
                      <Pressable onPress={() => setShowCountryPicker(false)}>
                        <LucideIcon
                          name="X"
                          size={24}
                          color={theme.colorText}
                        />
                      </Pressable>
                    </CountryPickerHeader>

                    <FlatList
                      data={countries}
                      keyExtractor={(item) => item.isoCode2}
                      renderItem={({ item }) => (
                        <CountryOption
                          onPress={() => {
                            setSelectedCountry(item);
                            setShowCountryPicker(false);
                            setPhone("");
                            setErrorMessage(null);
                          }}
                        >
                          <CountryOptionContent>
                            <Typography.Body color={theme.colorText}>
                              {getCountryFlag(item.isoCode2)} {item.countryName}
                            </Typography.Body>
                            <Typography.Caption
                              color={theme.colorTextSecondary}
                            >
                              {item.dialCode}
                            </Typography.Caption>
                          </CountryOptionContent>
                          {selectedCountry?.isoCode2 === item.isoCode2 && (
                            <LucideIcon
                              name="Check"
                              size={20}
                              color={theme.colorPrimary}
                            />
                          )}
                        </CountryOption>
                      )}
                    />
                  </CountryPickerContainer>
                </Modal>

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
                <InfoRow
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

// ─── Helper Functions ─────────────────────────────────────────────────────

function getCountryFlag(isoCode?: string): string {
  if (!isoCode || isoCode.length !== 2) return "🌍";

  // Convert ISO 3166-1 alpha-2 to flag emoji
  const codePoints = isoCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
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

const CountryCodeButton = styled.Pressable`
  padding-left: ${({ theme }) => theme.sizing.small}px;
  padding-right: ${({ theme }) => theme.sizing.small}px;
  padding-top: ${({ theme }) => theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.small}px;
  border-right-width: 1px;
  border-right-color: ${({ theme }) => theme.colorBorderSecondary};
  background-color: ${({ theme }) => theme.colorBgLayout};
  justify-content: center;
  align-items: center;
`;

const CountryCodeContent = styled(Row)`
  gap: ${({ theme }) => theme.sizing.xSmall}px;
  align-items: center;
`;

const CountryFlag = styled.Text`
  font-size: 20px;
  line-height: 24px;
`;

const DropdownIcon = styled.View`
  margin-left: ${({ theme }) => theme.sizing.xSmall}px;
`;

const CountryPickerContainer = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgContainer};
`;

const CountryPickerHeader = styled(Row)`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.sizing.large}px;
  border-bottom-width: 1px;
  border-bottom-color: ${({ theme }) => theme.colorBorder};
`;

const CountryOption = styled.Pressable`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.sizing.medium}px
    ${({ theme }) => theme.sizing.large}px;
  border-bottom-width: 1px;
  border-bottom-color: ${({ theme }) => theme.colorBgLayout};
`;

const CountryOptionContent = styled(Column)`
  flex: 1;
  gap: ${({ theme }) => theme.sizing.xSmall}px;
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
