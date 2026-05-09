import { Redirect } from "expo-router";
import { useSelector } from "react-redux";
import { selectIsSuperAdmin } from "../../store/auth-slice";
import type { RootState } from "../../store";
import { ROUTES } from '../../lib/navigation/routes';

/**
 * Routing root for authenticated users.
 *
 *   SUPER_ADMIN     → NO_ACCESS      (no store context)
 *   Everyone else   → ACCOUNT_TYPE   (workspace picker)
 *
 * The account-type screen routes the user further:
 *   "Business Account"  → store flow (NO_STORE if no default, STORE_HOME otherwise)
 *   "Personal Account"  → personal dashboard
 */
export default function ProtectedIndex() {
  const isSuperAdmin = useSelector((state: RootState) => selectIsSuperAdmin(state));

  if (isSuperAdmin) {
    return <Redirect href={ROUTES.NO_ACCESS} />;
  }

  return <Redirect href={ROUTES.ACCOUNT_TYPE} />;
}
