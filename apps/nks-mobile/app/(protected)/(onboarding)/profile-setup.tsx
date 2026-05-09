// Profile setup is bypassed — redirecting to store home
import { Redirect } from "expo-router";

export default function ProfileSetupRoute() {
  return <Redirect href="/(protected)/(store)/(tabs)/home" />;
}
