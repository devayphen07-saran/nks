import { router } from "expo-router";
import { Platform, KeyboardAvoidingView, Alert, View } from "react-native";
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
  Row,
  Typography,
} from "@nks/mobile-ui-components";
import { useMobileTheme } from "@nks/mobile-theme";
import { profileComplete } from "@nks/api-manager";
import { useRootDispatch } from "../../store";
import { refreshSession } from "../../store/refreshSession";

const schema = z
  .object({
    firstName: z.string().min(2, "Min 2 characters"),
    lastName: z.string().min(2, "Min 2 characters"),
    email: z.string().email("Please enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export function ProfileSetupScreen() {
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
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;
    const result = await dispatch(
      profileComplete({
        bodyParam: {
          name: fullName,
          email: data.email,
          password: data.password,
        },
      }),
    );

    if (profileComplete.fulfilled.match(result)) {
      await dispatch(refreshSession());
      Alert.alert("Success", "Profile completed successfully!", [
        {
          text: "OK",
          onPress: () =>
            router.replace("/(protected)/(workspace)/(app)/(account-type)"),
        },
      ]);
    } else {
      const msg =
        (result.payload as { message?: string })?.message ??
        "Profile completion failed. Please try again.";
      setError("email", { message: msg });
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
          {/* ── Hero ──────────────────────────────────── */}
          <Hero $topInset={insets.top}>
            <DecorRingTopRight />
            <DecorRingBottomLeft />
            <Column gap="medium" align="center" style={{ zIndex: 1 }}>
              <LogoCircle>
                <LucideIcon name="Lock" size={36} color={theme.colorPrimary} />
              </LogoCircle>
              <Column gap="xxSmall" align="center">
                <Typography.H3 weight="bold" color={theme.colorWhite}>
                  Complete Profile
                </Typography.H3>
                <Typography.Body
                  color={theme.colorWhite}
                  style={{ opacity: 0.85 }}
                >
                  Set up your email and password
                </Typography.Body>
              </Column>
            </Column>
          </Hero>

          {/* ── Form Card ─────────────────────────────── */}
          <FormCard
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.12,
              shadowRadius: 24,
              elevation: 8,
            }}
          >
            <Column gap="xxSmall">
              <Typography.H4 weight="bold">Profile Setup</Typography.H4>
              <Typography.Caption type="secondary">
                Complete your profile to access store features
              </Typography.Caption>
            </Column>

            <Divider />

            {/* Info Banner */}
            <InfoBanner>
              <LucideIcon name="Info" size={18} color={theme.colorWarning} />
              <InfoBannerText>
                <Typography.Caption type="secondary">
                  You logged in with phone number. Please set your email and
                  password to continue.
                </Typography.Caption>
              </InfoBannerText>
            </InfoBanner>

            {/* Name Row */}
            <NameRow>
              <View style={{ flex: 1 }}>
                <Input
                  name="firstName"
                  control={control}
                  label="First Name"
                  placeholder="John"
                  required
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  name="lastName"
                  control={control}
                  label="Last Name"
                  placeholder="Doe"
                  required
                />
              </View>
            </NameRow>

            <Input
              name="email"
              control={control}
              label="Email Address"
              placeholder="your.email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              required
            />

            <Input
              name="password"
              control={control}
              label="Password"
              placeholder="Min 8 characters"
              secureTextEntry
              required
            />

            <Input
              name="confirmPassword"
              control={control}
              label="Confirm Password"
              placeholder="Re-enter password"
              secureTextEntry
              required
            />

            <SubmitButton
              label="Complete Profile"
              size="xlg"
              variant="primary"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              disabled={isSubmitting}
            />
          </FormCard>

          {/* ── Footer ────────────────────────────────── */}
          <FooterArea>
            <BackButton onPress={() => router.back()}>
              <Row gap="xSmall" align="center">
                <LucideIcon
                  name="ArrowLeft"
                  size={18}
                  color={theme.colorPrimary}
                />
                <Typography.Body weight="semiBold" type="primary">
                  Go back
                </Typography.Body>
              </Row>
            </BackButton>
          </FooterArea>
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

const LogoCircle = styled.View`
  width: 80px;
  height: 80px;
  border-radius: 40px;
  background-color: ${({ theme }) => theme.colorWhite};
  align-items: center;
  justify-content: center;
`;

const FormCard = styled.View`
  margin-left: ${({ theme }) => theme.sizing.medium}px;
  margin-right: ${({ theme }) => theme.sizing.medium}px;
  margin-top: -${({ theme }) => theme.sizing.xLarge}px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius.xLarge}px;
  padding: ${({ theme }) => theme.sizing.xLarge}px;
`;

const Divider = styled.View`
  height: 1px;
  background-color: ${({ theme }) => theme.colorBorderSecondary};
  margin-top: ${({ theme }) => theme.sizing.large}px;
  margin-bottom: ${({ theme }) => theme.sizing.large}px;
`;

const InfoBanner = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: ${({ theme }) => theme.sizing.small}px;
  background-color: ${({ theme }) => theme.colorWarningBg};
  border-radius: ${({ theme }) => theme.borderRadius.medium}px;
  padding: ${({ theme }) => theme.sizing.medium}px;
  margin-bottom: ${({ theme }) => theme.sizing.large}px;
`;

const InfoBannerText = styled.View`
  flex: 1;
`;

const NameRow = styled.View`
  flex-direction: row;
  gap: ${({ theme }) => theme.sizing.medium}px;
`;

const SubmitButton = styled(Button)`
  margin-top: ${({ theme }) => theme.sizing.small}px;
`;

const FooterArea = styled.View`
  align-items: center;
  padding-top: ${({ theme }) => theme.sizing.large}px;
  padding-bottom: ${({ theme }) => theme.sizing.xLarge}px;
`;

const BackButton = styled.TouchableOpacity`
  padding: ${({ theme }) => theme.sizing.small}px
    ${({ theme }) => theme.sizing.large}px;
`;
