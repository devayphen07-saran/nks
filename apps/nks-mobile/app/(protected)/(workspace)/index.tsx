import { Redirect } from "expo-router";
import { useAuth } from "../../../store";

export default function WorkspaceIndex() {
  const authState = useAuth();
  const roles = authState.authResponse?.access?.roles ?? [];
  const isSuperAdmin = authState.authResponse?.access?.isSuperAdmin ?? false;

  const hasPersonalAccess = roles.some((r: any) => r.roleCode === "CUSTOMER");

  // No roles → account type selection
  if (roles.length === 0) {
    return <Redirect href="/(protected)/(workspace)/(app)/(onboarding)/account-type" />;
  }

  // Customer-only → personal dashboard
  if (hasPersonalAccess && !isSuperAdmin && roles.length === 1) {
    return <Redirect href="/(protected)/(workspace)/(app)/(personal)/dashboard" />;
  }

  // Has store roles → store list
  // StoreListScreen handles empty state + create store flow
  return <Redirect href="/(protected)/(workspace)/(app)/(store)/list" />;
}
