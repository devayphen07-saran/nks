// Profile setup is bypassed — redirecting to store list
import { Redirect } from "expo-router";

export default function ProfileSetupRoute() {
  return <Redirect href="/(protected)/(workspace)/(app)/(store)/list" />;
}
