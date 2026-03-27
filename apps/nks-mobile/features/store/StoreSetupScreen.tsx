import { router } from "expo-router";
import { Platform, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import styled from "styled-components/native";
import {
  Button,
  Column,
  Input,
  LucideIcon,
  Typography,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { registerStore, type RegisterStoreRequest } from "@nks/api-manager";
import { useRootDispatch } from "../../store";
import { refreshSession } from "../../store/refreshSession";

const schema = z.object({
  storeName: z.string().min(2, "Store name must be at least 2 characters"),
  storeCode: z
    .string()
    .min(2, "Store code must be at least 2 characters")
    .max(50, "Store code max 50 characters")
    .regex(/^[A-Z0-9_]+$/, "Only uppercase letters, numbers, and underscores"),
  storeTypeCode: z.string().min(1, "Store type is required"),
});
type FormData = z.infer<typeof schema>;

export function StoreSetupScreen() {
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useRootDispatch();

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { storeName: "", storeCode: "", storeTypeCode: "RETAIL" },
  });

  const onSubmit = async (data: FormData) => {
    const body: RegisterStoreRequest = {
      storeName: data.storeName,
      storeCode: data.storeCode,
      storeTypeCode: data.storeTypeCode,
    };
    const result = await dispatch(registerStore({ bodyParam: body }));
    if (registerStore.fulfilled.match(result)) {
      await dispatch(refreshSession());
      router.replace("/(protected)/(workspace)/(app)/(store)/main");
    } else {
      const msg =
        (result.payload as { message?: string })?.message ??
        "Store creation failed. Please try again.";
      setError("storeName", { message: msg });
    }
  };

  return (
    <Container>
      <KeyboardAvoiding behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollArea
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Hero $topInset={insets.top}>
            <DecorRingTopRight />
            <DecorRingBottomLeft />
            <HeroContent align="center" gap="xSmall">
              <LogoCircle>
                <LucideIcon name="Store" size={36} color={theme.colorPrimary} />
              </LogoCircle>
              <Typography.H3 weight="bold" color={theme.colorWhite}>
                NKS
              </Typography.H3>
              <Typography.Body color={theme.colorWhite}>
                Set up your store
              </Typography.Body>
            </HeroContent>
          </Hero>

          <FormCard
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.12,
              shadowRadius: 24,
              elevation: 8,
            }}
          >
            <FormHeader gap="xxSmall">
              <Typography.H4 weight="bold">Create your store</Typography.H4>
              <Typography.Body type="secondary">
                You can update these details later from settings
              </Typography.Body>
            </FormHeader>

            <Column gap="xxSmall">
              <Input
                name="storeName"
                control={control}
                label="Store name"
                placeholder="e.g. Nila Stores"
                required
              />

              <Input
                name="storeCode"
                control={control}
                label="Store code"
                placeholder="e.g. NILA_STORES"
                required
              />

              <Input
                name="storeTypeCode"
                control={control}
                label="Store type"
                placeholder="e.g. RETAIL"
                required
              />

              <SubmitButton
                label="Create Store"
                size="xlg"
                variant="primary"
                onPress={handleSubmit(onSubmit)}
                loading={isSubmitting}
              />
            </Column>
          </FormCard>

          <Column flex={1} justify="flex-end" align="center" padding="xLarge">
            <BackButton onPress={() => router.back()}>
              <Typography.Body weight="semiBold" type="primary">
                Go back
              </Typography.Body>
            </BackButton>
          </Column>
        </ScrollArea>
      </KeyboardAvoiding>
    </Container>
  );
}

// ─── Styled Components ────────────────────────────────────────────────────────

const Container = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colorPrimary};
`;

const KeyboardAvoiding = styled(KeyboardAvoidingView)`
  flex: 1;
`;

const ScrollArea = styled.ScrollView`
  flex: 1;
  background-color: ${({ theme }) => theme.colorBgLayout};
`;

const Hero = styled.View<{ $topInset: number }>`
  background-color: ${({ theme }) => theme.colorPrimary};
  padding-top: ${({ theme, $topInset }) => theme.sizing.xLarge + $topInset}px;
  padding-bottom: ${({ theme }) =>
    theme.sizing.xxLarge + theme.sizing.xLarge}px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const DecorRingTopRight = styled.View`
  position: absolute;
  width: 240px;
  height: 240px;
  border-radius: 120px;
  border-width: 40px;
  border-color: ${({ theme }) => theme.colorWhite};
  opacity: 0.07;
  top: -80px;
  right: -60px;
`;

const DecorRingBottomLeft = styled.View`
  position: absolute;
  width: 160px;
  height: 160px;
  border-radius: 80px;
  border-width: 30px;
  border-color: ${({ theme }) => theme.colorWhite};
  opacity: 0.07;
  bottom: -50px;
  left: -30px;
`;

const HeroContent = styled(Column)``;

const LogoCircle = styled.View`
  width: 80px;
  height: 80px;
  border-radius: 40px;
  background-color: ${({ theme }) => theme.colorWhite};
  align-items: center;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.sizing.xSmall}px;
`;

const FormCard = styled(Column)`
  margin-left: ${({ theme }) => theme.sizing.medium}px;
  margin-right: ${({ theme }) => theme.sizing.medium}px;
  margin-top: -${({ theme }) => theme.sizing.xLarge}px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.xLarge}px;
  padding: ${({ theme }) => theme.sizing.xLarge}px;
`;

const FormHeader = styled(Column)`
  margin-bottom: ${({ theme }) => theme.sizing.large}px;
`;

const SubmitButton = styled(Button)`
  margin-top: ${({ theme }) => theme.sizing.xSmall}px;
`;

const BackButton = styled.TouchableOpacity`
  padding-top: ${({ theme }) => theme.sizing.xxSmall}px;
  padding-bottom: ${({ theme }) => theme.sizing.xxSmall}px;
`;
