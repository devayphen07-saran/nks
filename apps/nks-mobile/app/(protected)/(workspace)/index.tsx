import { Redirect } from "expo-router";
import { useSelector } from "react-redux";
import { useAuth } from "../../../store";
import { selectIsSuperAdmin } from "../../../store/auth-slice";
import type { RootState } from "../../../store";

export default function WorkspaceIndex() {
  const authState = useAuth();
  const roles = authState.authResponse?.access?.roles ?? [];
  const isSuperAdmin = useSelector((state: RootState) => selectIsSuperAdmin(state));

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
