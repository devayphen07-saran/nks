import { useState } from "react";
import { Platform, Keyboard } from "react-native";
import { router } from "expo-router";
import { useSelector } from "react-redux";
import { ROUTES } from "../../lib/navigation/routes";
import type { RootState } from "../../store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import styled from "styled-components/native";
import {
  Button,
  Column,
  LucideIcon,
  Typography,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { useStoreSetupForm } from "./hooks/useStoreSetupForm";
import { useStoreSetupSubmit } from "./hooks/useStoreSetupSubmit";
import {
  StoreSetupStep1,
  StoreSetupStep2,
  StoreSetupStep3,
} from "./components";
import {
  KeyboardAvoiding,
  PageScroll,
  ErrorBanner,
  ErrorText,
} from "../auth/components/auth-screen-styles";

const STEPS = [
  { title: "Store details",  subtitle: "Basic information about this store." },
  { title: "Regulatory",     subtitle: "Tax registration and identifiers." },
  { title: "Store address",  subtitle: "Where your customers find this store." },
] as const;

const TOTAL_STEPS = STEPS.length;

export function StoreSetupScreen() {
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const form = useStoreSetupForm();
  const { handleSubmit, trigger } = form;
  const activeStoreGuuid = useSelector((s: RootState) => s.store.activeStoreGuuid);

  const { handleSubmit: submitStore, isLoading, errorMessage, clearError } =
    useStoreSetupSubmit();

  const [currentStep, setCurrentStep] = useState(1);

  const step = STEPS[currentStep - 1];
  const isLast = currentStep === TOTAL_STEPS;

  const handleNext = async () => {
    Keyboard.dismiss();
    clearError();
    let valid = false;

    if (currentStep === 1) {
      valid = await trigger([
        "storeName",
        "storeCode",
        "storeLegalTypeCode",
        "storeCategoryCode",
      ]);
    } else if (currentStep === 2) {
      valid = await trigger(["registrationNumber", "taxNumber"]);
    } else if (currentStep === 3) {
      valid = await trigger(["addressLine1", "city", "pincode", "stateGuuid"]);
    }

    if (valid) setCurrentStep((p) => p + 1);
  };

  const handleBack = () => {
    Keyboard.dismiss();
    clearError();
    if (currentStep > 1) {
      setCurrentStep((p) => p - 1);
      return;
    }
    // At step 1: drawer screens don't keep a router stack we can pop. If the
    // user already has an active store they came from the home header's "+",
    // so route them back there. Otherwise (first-time onboarding) there is
    // no destination to go back to — leave the form in place.
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (activeStoreGuuid) {
      router.replace(ROUTES.STORE_HOME);
    }
  };

  return (
    <PageBg>
      <KeyboardAvoiding behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {/* ─── Top Bar ─── */}
        <TopBar $topInset={insets.top}>
          <BackLink onPress={handleBack} hitSlop={8}>
            <LucideIcon name="ChevronLeft" size={18} color={theme.colorTextSecondary} />
            <Typography.Caption
              weight="medium"
              color={theme.colorTextSecondary}
              style={{ marginLeft: 4 }}
            >
              Back
            </Typography.Caption>
          </BackLink>
          <Typography.Caption color={theme.colorTextTertiary}>
            Step {currentStep} of {TOTAL_STEPS}
          </Typography.Caption>
        </TopBar>

        {/* ─── Hairline Progress ─── */}
        <ProgressTrack>
          <ProgressFill style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }} />
        </ProgressTrack>

        <PageScroll
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Body>
            {/* ─── Section Header ─── */}
            <Column gap={6}>
              <Typography.H2 weight="semiBold" color={theme.colorText}>
                {step.title}
              </Typography.H2>
              <Typography.Caption
                color={theme.colorTextSecondary}
                style={{ fontSize: 14, lineHeight: 20 }}
              >
                {step.subtitle}
              </Typography.Caption>
            </Column>

            {/* ─── Error ─── */}
            {errorMessage && (
              <ErrorBanner gap="xSmall" align="center">
                <LucideIcon
                  name="AlertCircle"
                  size={14}
                  color={theme.colorError}
                />
                <ErrorText weight="medium">{errorMessage}</ErrorText>
              </ErrorBanner>
            )}

            {/* ─── Form Fields ─── */}
            {currentStep === 1 && <StoreSetupStep1 form={form} />}
            {currentStep === 2 && <StoreSetupStep2 form={form} />}
            {currentStep === 3 && <StoreSetupStep3 form={form} />}
          </Body>
        </PageScroll>

        {/* ─── Sticky Bottom Action Bar ─── */}
        <BottomBar $bottomInset={insets.bottom}>
          <Button
            label={
              isLast
                ? isLoading
                  ? "Creating…"
                  : "Create store"
                : "Continue"
            }
            size="xlg"
            variant="primary"
            onPress={isLast ? handleSubmit(submitStore) : handleNext}
            loading={isLoading}
            disabled={isLoading}
            style={{ borderRadius: 10 }}
          />
        </BottomBar>
      </KeyboardAvoiding>
    </PageBg>
  );
}

// ─── Styled Components ────────────────────────────────────────────────────────

const PageBg = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const TopBar = styled.View<{ $topInset: number }>`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-top: ${({ $topInset, theme }) => $topInset + theme.sizing.small}px;
  padding-bottom: ${({ theme }) => theme.sizing.small}px;
  padding-left: ${({ theme }) => theme.sizing.large}px;
  padding-right: ${({ theme }) => theme.sizing.large}px;
  background-color: ${({ theme }) => theme.colorBgContainer};
`;

const BackLink = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  height: 32px;
`;

const ProgressTrack = styled.View`
  height: 2px;
  background-color: ${({ theme }) => theme.colorBorderSecondary};
  width: 100%;
`;

const ProgressFill = styled.View`
  height: 100%;
  background-color: ${({ theme }) => theme.colorPrimary};
`;

const Body = styled(Column).attrs({ gap: "large" })`
  padding-left: ${({ theme }) => theme.sizing.large}px;
  padding-right: ${({ theme }) => theme.sizing.large}px;
  padding-top: ${({ theme }) => theme.sizing.large}px;
`;

const BottomBar = styled.View<{ $bottomInset: number }>`
  padding-left: ${({ theme }) => theme.sizing.large}px;
  padding-right: ${({ theme }) => theme.sizing.large}px;
  padding-top: ${({ theme }) => theme.sizing.medium}px;
  padding-bottom: ${({ $bottomInset, theme }) =>
    $bottomInset + theme.sizing.medium}px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-top-width: 1px;
  border-top-color: ${({ theme }) => theme.colorBorderSecondary};
`;
