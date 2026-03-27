import { Stack } from "expo-router";

export default function StoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="list" />
      <Stack.Screen name="select" />
      <Stack.Screen name="(dashboard)" />
      <Stack.Screen name="setup" />
    </Stack>
  );
}