import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import { useCallback } from "react";

export default function AppLayout() {
  const router = useRouter();

  // Always start with onboarding - userType is now managed locally
  // On focus, check Redux for selectedWorkspaceType
  useFocusEffect(
    useCallback(() => {
      // App always starts with onboarding since backend no longer sends userType
      // The account-type screen will navigate to store/setup or personal/dashboard
      router.replace(
        "/(protected)/(workspace)/(app)/(onboarding)/account-type"
      );
    }, [router]),
  );

  return (
    <Stack screenOptions={{ headerShown: false }} initialRouteName="(onboarding)">
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(personal)" />
      <Stack.Screen name="(store)" />
    </Stack>
  );
}
