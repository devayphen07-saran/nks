import { Redirect, Stack } from "expo-router";
import { useAuthContext } from '../../lib/auth/auth-provider';
import { LoadingFallback } from "../../components/feedback/LoadingFallback";

export default function AuthLayout() {
  const { isLoggedIn, isLoading } = useAuthContext();

  if (isLoading) return <LoadingFallback />;

  if (isLoggedIn) return <Redirect href="/(protected)" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "none",
        contentStyle: { backgroundColor: "#ffffff" },
      }}
    >
      <Stack.Screen name="phone" />
      <Stack.Screen name="otp" />
    </Stack>
  );
}
