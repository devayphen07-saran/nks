import React, { useState } from "react";
import {
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Keyboard,
} from "react-native";
import { router } from "expo-router";
import styled from "styled-components/native";
import {
  Typography,
  Button,
  Column,
  Row,
  LucideIcon,
  Header,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { useStoreSetupForm, type StoreFormValues } from "./hooks/useStoreSetupForm";
import { StoreSetupStep1, StoreSetupStep2, StoreSetupStep3 } from "./components";

export function StoreSetupScreen() {
  const { theme } = useMobileTheme();
  const form = useStoreSetupForm();
  const { handleSubmit, trigger } = form;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  // TODO: Dispatch getAllCountry and getAllConfig API calls on mount

  const handleNext = async () => {
    Keyboard.dismiss();
    setError(null);
    let isStepValid = false;

    if (currentStep === 1) {
      isStepValid = await trigger([
        "storeName",
        "storeCode",
        "storeLegalTypeCode",
        "storeCategoryCode",
      ]);
    } else if (currentStep === 2) {
      isStepValid = await trigger(["registrationNumber", "taxNumber"]);
    }

    if (isStepValid) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    Keyboard.dismiss();
    setError(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    } else {
      router.back();
    }
  };

  const onSubmit = async (values: StoreFormValues) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Dispatch store/register API call (apiPost or thunk action)
      console.log("Registering store with values:", values);
      setLoading(false);
      router.push("/(protected)/(store)/list");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <Container>
      <Header
        title={
          currentStep === 1
            ? "Basic Info"
            : currentStep === 2
              ? "Legal & Tax"
              : "Location"
        }
        leftElement={
          <TouchableOpacity onPress={handleBack}>
            <LucideIcon name="ChevronLeft" size={24} />
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Content gap="medium">
            <ProgressBar>
              <ProgressStep isActive={currentStep >= 1} />
              <ProgressLine isActive={currentStep >= 2} />
              <ProgressStep isActive={currentStep >= 2} />
              <ProgressLine isActive={currentStep >= 3} />
              <ProgressStep isActive={currentStep >= 3} />
            </ProgressBar>

            <HeroSection>
              <IconCircle>
                <LucideIcon
                  name={
                    currentStep === 1
                      ? "Building"
                      : currentStep === 2
                        ? "FileText"
                        : "MapPin"
                  }
                  size={32}
                  color={theme.colorPrimary}
                />
              </IconCircle>
              <HeroContent gap="xxSmall">
                <Typography.H4 weight="bold">
                  {currentStep === 1
                    ? "Store Details"
                    : currentStep === 2
                      ? "Regulatory"
                      : "Store Address"}
                </Typography.H4>
                <Typography.Body type="secondary" style={{ fontSize: 13 }}>
                  {currentStep === 1
                    ? "Start with the basic shop identity"
                    : currentStep === 2
                      ? "Enter taxation and registration"
                      : "Where is this store located?"}
                </Typography.Body>
              </HeroContent>
            </HeroSection>

            {error && (
              <ErrorBox>
                <LucideIcon
                  name="AlertCircle"
                  size={18}
                  color={theme.colorError}
                />
                <Typography.Body
                  color={theme.colorError}
                  style={{ marginLeft: 12, flex: 1 }}
                >
                  {error}
                </Typography.Body>
              </ErrorBox>
            )}

            {currentStep === 1 && <StoreSetupStep1 form={form} />}
            {currentStep === 2 && <StoreSetupStep2 form={form} />}
            {currentStep === 3 && <StoreSetupStep3 form={form} />}

            <Footer>
              {currentStep < 3 ? (
                <Button
                  onPress={handleNext}
                  variant="primary"
                  style={{ width: "100%" }}
                >
                  Continue to {currentStep === 1 ? "Regulatory" : "Address"}
                </Button>
              ) : (
                <Button
                  onPress={handleSubmit(onSubmit)}
                  disabled={loading}
                  loading={loading}
                  variant="primary"
                  style={{ width: "100%" }}
                >
                  {loading ? "Creating..." : "Confirm & Create Store"}
                </Button>
              )}
            </Footer>
          </Content>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
}

const Container = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const Content = styled(Column)`
  padding: ${({ theme }) => theme.sizing.large}px;
  padding-bottom: ${({ theme }) => theme.sizing.xLarge}px;
`;

const Footer = styled.View`
  padding-top: ${({ theme }) => theme.sizing.large}px;
`;

const ProgressBar = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  margin-top: ${({ theme }) => theme.sizing.small}px;
  margin-bottom: ${({ theme }) => theme.sizing.xLarge}px;
`;

const ProgressStep = styled.View<{ isActive: boolean }>`
  width: 12px;
  height: 12px;
  border-radius: 6px;
  background-color: ${({ theme, isActive }) =>
    isActive ? theme.colorPrimary : theme.colorBorderSecondary};
`;

const ProgressLine = styled.View<{ isActive: boolean }>`
  flex: 1;
  height: 2px;
  background-color: ${({ theme, isActive }) =>
    isActive ? theme.colorPrimary : theme.colorBorderSecondary};
  margin: 0 ${({ theme }) => theme.sizing.small}px;
  max-width: 40px;
`;

const HeroSection = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.sizing.medium}px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  padding: ${({ theme }) => theme.sizing.large}px;
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorBorderSecondary};
  margin-bottom: ${({ theme }) => theme.sizing.large}px;
`;

const HeroContent = styled(Column)`
  flex: 1;
`;

const IconCircle = styled.View`
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background-color: ${({ theme }) => theme.colorPrimary}15;
  align-items: center;
  justify-content: center;
`;

const ErrorBox = styled(Row)`
  background-color: ${({ theme }) => theme.colorErrorBg ?? "#fff1f0"};
  padding: ${({ theme }) => theme.sizing.medium}px;
  border-radius: ${({ theme }) => theme.borderRadius.large}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colorError};
  align-items: center;
  margin-bottom: ${({ theme }) => theme.sizing.medium}px;
`;
