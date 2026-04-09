import { Redirect, Stack } from "expo-router";
import { useAuthGuard } from "../../lib/auth-provider";
import { LoadingFallback } from "../../components/feedback/LoadingFallback";

export default function ProtectedLayout() {
  const { isLoggedIn, isLoading } = useAuthGuard();

  if (isLoading) return <LoadingFallback />;

  if (!isLoggedIn) return <Redirect href="/(auth)/phone" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(workspace)" />
    </Stack>
  );
}
