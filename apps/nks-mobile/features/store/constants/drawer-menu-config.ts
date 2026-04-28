/**
 * Drawer menu types — shape only.
 *
 * Menu items are NOT statically mapped to role codes here.
 * They are provided at runtime by the backend routes API
 * (GET /routes/store/:storeId/routes) which returns the exact
 * screens the authenticated user can access based on their DB-stored
 * role and permission assignments.
 *
 * No role code union, no static ROLE_MENU_MAP — adding a new role or
 * changing which screens it can access is a DB-only operation.
 */
export interface MenuItem {
  label: string;
  iconName: string;
  route: string;
}
