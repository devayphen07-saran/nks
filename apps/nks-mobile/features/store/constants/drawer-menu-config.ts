export type RoleCode = 'STORE_OWNER' | 'MANAGER' | 'CASHIER' | 'DELIVERY' | 'CUSTOMER';

export interface MenuItem {
  label: string;
  iconName: string;
  route: string;
}

export const ROLE_MENU_MAP: Record<RoleCode, MenuItem[]> = {
  STORE_OWNER: [
    { label: 'Dashboard', iconName: 'LayoutDashboard', route: 'store' },
    { label: 'Products', iconName: 'Package', route: 'products' },
    { label: 'Orders', iconName: 'ShoppingCart', route: 'orders' },
    { label: 'Staff', iconName: 'Users', route: 'staff' },
    { label: 'Settings', iconName: 'Settings', route: 'settings' },
  ],
  MANAGER: [
    { label: 'Dashboard', iconName: 'LayoutDashboard', route: 'store' },
    { label: 'Products', iconName: 'Package', route: 'products' },
    { label: 'Orders', iconName: 'ShoppingCart', route: 'orders' },
  ],
  CASHIER: [
    { label: 'POS', iconName: 'CreditCard', route: 'pos' },
    { label: 'Orders', iconName: 'ShoppingCart', route: 'orders' },
  ],
  DELIVERY: [
    { label: 'Deliveries', iconName: 'Truck', route: 'deliveries' },
  ],
  CUSTOMER: [
    { label: 'Dashboard', iconName: 'LayoutDashboard', route: 'store' },
  ],
};
