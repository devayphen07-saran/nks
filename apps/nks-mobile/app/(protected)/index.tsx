import { Redirect } from "expo-router";
import { useSelector } from "react-redux";
import { selectIsSuperAdmin } from "../../store/auth-slice";
import { useAuthState } from "../../store";
import type { RootState } from "../../store";
import { ROUTES } from '../../lib/navigation/routes';

export default function ProtectedIndex() {
  const authState = useAuthState();
  const isSuperAdmin = useSelector((state: RootState) => selectIsSuperAdmin(state));
  const defaultStoreGuuid = authState.authResponse?.context?.defaultStoreGuuid;

  if (isSuperAdmin) {
    return <Redirect href={ROUTES.NO_ACCESS} />;
  }

  if (!defaultStoreGuuid) {
    return <Redirect href={ROUTES.STORE_SETUP} />;
  }

  return <Redirect href={ROUTES.STORE_HOME} />;
}
