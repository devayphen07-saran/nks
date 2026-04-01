import { Stack } from "expo-router";

export default function DebugLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen
        name="database"
        options={{
          title: "Database Debug",
        }}
      />
    </Stack>
  );
}
