import { Redirect, Stack } from "expo-router";
import { useAuthContext } from '../../lib/auth/auth-provider';

export default function AuthLayout() {
  const { isLoggedIn, isLoading } = useAuthContext();

  // If the user is already authenticated, kick them out of the auth stack.
  if (!isLoading && isLoggedIn) {
    return <Redirect href="/(protected)" />;
  }

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
