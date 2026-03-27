import { Stack } from "expo-router";
import { LoadingFallback } from "../../../components/feedback/LoadingFallback";
import { useAuth } from "store";

export default function WorkspaceLayout() {
  const { isInitializing } = useAuth();

  if (isInitializing) {
    return <LoadingFallback />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(app)" />
    </Stack>
  );
}
