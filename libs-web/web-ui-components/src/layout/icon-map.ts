import {
  Home,
  Settings,
  Users,
  Package,
  ShoppingCart,
  Building2,
  Shield,
  FileText,
  CreditCard,
  Activity,
  BarChart3,
  LayoutDashboard,
  Box,
  Truck,
  Users2,
  Lock,
  Globe,
  Bell,
  Mail,
  PieChart,
  Calendar,
  Layers,
  Store,
  ShoppingBag,
  BarChart,
  UserCircle,
  HelpCircle,
  Search,
  Plus,
  Grid3x3,
  Menu,
  PanelLeftClose,
  PanelLeft,
  X,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Map of icon names to Lucide icon components.
 * This allows backend-driven menus to specify icons by string name.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  Settings,
  Users,
  Package,
  ShoppingCart,
  Building2,
  Shield,
  FileText,
  CreditCard,
  Activity,
  BarChart3,
  LayoutDashboard,
  Box,
  Truck,
  Users2,
  Lock,
  Globe,
  Bell,
  Mail,
  PieChart,
  Calendar,
  Layers,
  Store,
  ShoppingBag,
  BarChart,
  UserCircle,
  HelpCircle,
  Search,
  Plus,
  Grid3x3,
  Menu,
  PanelLeftClose,
  PanelLeft,
  X,
  ChevronRight,
};

/**
 * Resolve a Lucide icon component from its name string
 */
export function getIconFromName(name: string | undefined | null): LucideIcon {
  if (!name || !ICON_MAP[name]) {
    return Box; // Default icon
  }
  return ICON_MAP[name];
}
