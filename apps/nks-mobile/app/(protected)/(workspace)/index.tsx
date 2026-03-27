import { Redirect } from "expo-router";
import { useAuth } from "../../../store";

export default function WorkspaceIndex() {
  const authState = useAuth();
  const roles = authState.authResponse?.data?.access?.roles ?? [];
  const isSuperAdmin = authState.authResponse?.data?.access?.isSuperAdmin ?? false;

  const hasPersonalAccess = roles.some((r: any) => r.roleCode === "CUSTOMER");

  // Customer-only → personal dashboard
  if (hasPersonalAccess && !isSuperAdmin && roles.length === 1) {
    return <Redirect href="/(protected)/(workspace)/(app)/(personal)/dashboard" />;
  }

  // Everyone else (new user, store owner, staff, super admin) → store list
  // StoreListScreen handles empty state + create store flow
  return <Redirect href="/(protected)/(workspace)/(app)/(store)/list" />;
}
