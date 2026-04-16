import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import { selectIsSuperAdmin } from '../../../store/auth-slice';
import { ROLE_MENU_MAP, type MenuItem, type RoleCode } from '../constants/drawer-menu-config';

export function useActiveStoreRole() {
  const authState = useSelector((state: RootState) => state.auth);
  const access = authState.authResponse?.access;
  const isSuperAdmin = useSelector(selectIsSuperAdmin);

  const activeStoreId = access?.activeStoreId;
  const roles = access?.roles ?? [];

  // Find the primary role for the active store
  const activeStoreRole = roles.find(
    (role) => role.storeId === activeStoreId && role.isPrimary
  );

  const activeRole = activeStoreRole?.roleCode as RoleCode | undefined;
  const activeStoreName = activeStoreRole?.storeName;
  const menuItems: MenuItem[] = activeRole
    ? ROLE_MENU_MAP[activeRole] ?? []
    : [];

  return {
    activeStoreId,
    activeStoreName,
    activeRole,
    menuItems,
    isSuperAdmin,
    isOwner: activeRole === 'STORE_OWNER',
  };
}
