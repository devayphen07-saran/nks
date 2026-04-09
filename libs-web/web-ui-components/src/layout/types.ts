import * as React from "react";

/**
 * Navigation item for sidebar and bottom nav
 */
export interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number | string;
}

/**
 * Navigation item with optional children for nested menus (2 levels max)
 * Used for dynamic menus fetched from API
 */
export interface NavItemWithChildren extends Omit<NavItem, "href"> {
  /** href is optional for parent items with children */
  href?: string;
  /** Child menu items (max 1 level deep) */
  children?: NavItem[];
  /** Unique ID for tracking expanded state */
  id: string | number;
}

/**
 * Props for menu item click callback
 */
export interface MenuClickProps {
  item: NavItem | NavItemWithChildren;
  event: React.MouseEvent;
}

/**
 * Quick access app for right bar
 */
export interface QuickApp {
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind color class e.g., "bg-app-books", "bg-app-timesheet" */
  color: string;
  label: string;
  onClick?: () => void;
  href?: string;
}

/**
 * Breadcrumb nav item
 */
export interface BreadcrumbNavItem {
  label: string;
  /** If undefined, this is the current page (no link) */
  href?: string;
}

/**
 * Sidebar configuration - logo and navigation items
 */
export interface SidebarConfig {
  /** Logo icon (always visible) */
  logoIcon: React.ReactNode;
  /** Logo text (hidden when sidebar is collapsed) */
  logoText?: React.ReactNode;
  /** Navigation items (flat list - for backward compatibility) */
  items?: NavItem[];
  /** Navigation items with nested children (for dynamic menus from API) */
  menuItems?: NavItemWithChildren[];
  /** Callback when a menu item is clicked */
  onMenuClick?: (props: MenuClickProps) => void;
}

/**
 * Quick action item for create menu
 */
export interface QuickActionItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  href?: string;
}

/**
 * Quick action group for create menu
 */
export interface QuickActionGroup {
  label: string;
  items: QuickActionItem[];
}

/**
 * Header configuration
 */
export interface HeaderConfig {
  pageTitle?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  companySwitcher?: React.ReactNode;
  notifications?: React.ReactNode;
  settings?: React.ReactNode;
  /** Custom create menu, or use quickActionGroups for default multi-column menu */
  createMenu?: React.ReactNode;
  /** Quick action groups for multi-column create menu (Sales, Purchase, Accounts, etc.) */
  quickActionGroups?: QuickActionGroup[];
  allApps?: QuickApp[];
  /** Profile drawer component - renders user profile with drawer functionality */
  profileDrawer?: React.ReactNode;
  /** Additional content for the right side of the header */
  rightContent?: React.ReactNode;
}

/**
 * AppLayout props - main shell wrapper
 */
export interface AppLayoutProps {
  /** Sidebar configuration with logo and nav items */
  sidebar: SidebarConfig;
  /** Header configuration */
  header: HeaderConfig;
  /** Quick access apps for right bar */
  quickApps?: QuickApp[];
  /** Defaults to sidebar.items if not provided (first 5 items) */
  bottomNavItems?: NavItem[];
  children: React.ReactNode;
}

/**
 * PageLayout props - page content wrapper with sticky header
 */
export interface PageLayoutProps {
  breadcrumb?: BreadcrumbNavItem[];
  title: React.ReactNode;
  /** Page title - if not provided, the sticky header is hidden */
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * SubMenuPageLayout props - page with fixed left sub-menu
 */
export interface SubMenuPageLayoutProps extends PageLayoutProps {
  subMenuItems: NavItem[];
}

/**
 * Layout context value
 */
export interface LayoutContextValue {
  sidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;
  toggleSidebar: () => void;
  isMobile: boolean;
  isTablet: boolean;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}
