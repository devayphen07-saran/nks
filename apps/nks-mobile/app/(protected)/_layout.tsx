import { Redirect, Stack } from "expo-router";
import { useAuthContext } from '../../lib/auth/auth-provider';
import { LoadingFallback } from "../../components/feedback/LoadingFallback";

export default function ProtectedLayout() {
  const { isLoggedIn, isLoading } = useAuthContext();

  if (isLoading) return <LoadingFallback />;

  if (!isLoggedIn) return <Redirect href="/(auth)/phone" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="no-access" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(personal)" />
      <Stack.Screen name="(store)" />
    </Stack>
  );
}
