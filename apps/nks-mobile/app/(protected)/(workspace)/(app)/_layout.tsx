import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false }}
      initialRouteName="(onboarding)"
    >
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(personal)" />
      <Stack.Screen name="(store)" />
      <Stack.Screen name="(debug)" options={{ headerShown: false }} />
    </Stack>
  );
}
