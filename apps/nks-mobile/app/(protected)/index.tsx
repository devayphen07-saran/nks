import { Redirect } from "expo-router";
import { useSelector } from "react-redux";
import { selectIsSuperAdmin } from "../../store/auth-slice";
import { useAuthState } from "../../store";
import type { RootState } from "../../store";
import { ROUTES } from '../../lib/navigation/routes';

export default function ProtectedIndex() {
  const authState = useAuthState();
  const isSuperAdmin = useSelector((state: RootState) => selectIsSuperAdmin(state));
  const defaultStore = authState.authResponse?.context?.defaultStoreGuuid;

  // Mobile app is for store users only — block SUPER_ADMIN accounts
  if (isSuperAdmin) {
    return <Redirect href={ROUTES.NO_ACCESS} />;
  }

  // No default store → user has no store yet, prompt to create one
  if (!defaultStore) {
    return <Redirect href={ROUTES.STORE_SETUP} />;
  }

  // Has a default store → go to store stack (store API called from there)
  return <Redirect href={ROUTES.STORE_LIST} />;
}
