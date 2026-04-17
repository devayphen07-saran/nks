import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import { selectIsSuperAdmin } from '../../../store/auth-slice';
import { type MenuItem, type RoleCode } from '../constants/drawer-menu-config';

/**
 * Provides the active store context for drawer/menu rendering.
 * activeStoreId comes from storeSlice (set after store API call).
 * activeRole/menuItems will be populated once the store roles state is implemented.
 */
export function useActiveStoreRole() {
  const activeStoreId = useSelector((state: RootState) => state.store.selectedStoreId);
  const isSuperAdmin = useSelector(selectIsSuperAdmin);

  // Role and menu data will come from the store API response state (to be implemented).
  const activeRole: RoleCode | undefined = undefined;
  const activeStoreName: string | undefined = undefined;
  const menuItems: MenuItem[] = [];

  return {
    activeStoreId,
    activeStoreName,
    activeRole,
    menuItems,
    isSuperAdmin,
    isOwner: false,
  };
}
