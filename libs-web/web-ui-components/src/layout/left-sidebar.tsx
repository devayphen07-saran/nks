"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, ChevronRight, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetTitle } from "../ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { useLayout } from "./context";
import type { NavItem, NavItemWithChildren, MenuClickProps } from "./types";

interface LeftSidebarProps {
  logoIcon: React.ReactNode;
  logoText?: React.ReactNode;
  /** Flat navigation items (backward compatible) */
  items?: NavItem[];
  /** Navigation items with optional children (for dynamic menus) */
  menuItems?: NavItemWithChildren[];
  /** Callback when a menu item is clicked */
  onMenuClick?: (props: MenuClickProps) => void;
  className?: string;
}

export function LeftSidebar({
  logoIcon,
  logoText,
  items,
  menuItems,
  onMenuClick,
  className,
}: LeftSidebarProps) {
  const pathname = usePathname();
  const { sidebarExpanded, toggleSidebar, isMobile, isTablet, mobileMenuOpen, setMobileMenuOpen } = useLayout();

  // Track which single parent item is expanded (accordion behavior - only one open at a time)
  const [expandedId, setExpandedId] = React.useState<string | number | null>(null);

  // Convert legacy items to menuItems format if needed
  const resolvedMenuItems: NavItemWithChildren[] = React.useMemo(() => {
    if (menuItems && menuItems.length > 0) return menuItems;
    if (items && items.length > 0) {
      return items.map((item, index) => ({
        ...item,
        id: item.href || index,
      }));
    }
    return [];
  }, [items, menuItems]);

  // Auto-expand parent if child is active (on initial load)
  React.useEffect(() => {
    if (resolvedMenuItems.length > 0) {
      const activeParent = resolvedMenuItems.find((item) =>
        item.children?.some(
          (child) => pathname === child.href || pathname.startsWith(`${child.href}/`)
        )
      );
      if (activeParent) {
        setExpandedId(activeParent.id);
      }
    }
  }, [pathname, resolvedMenuItems]);

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname, setMobileMenuOpen]);

  // Accordion toggle: clicking an item closes others
  const toggleExpanded = (id: string | number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleItemClick = (item: NavItem | NavItemWithChildren, event: React.MouseEvent) => {
    onMenuClick?.({ item, event });
  };

  // Check if an item is active
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Menu button styles
  const menuButtonStyles = cn(
    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none",
    "transition-all duration-150 hover:bg-accent hover:text-accent-foreground",
    "focus-visible:ring-2 focus-visible:ring-ring",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&>span:last-child]:truncate [&>svg]:size-[18px] [&>svg]:shrink-0",
    "text-muted-foreground font-medium"
  );

  // Sub-menu button styles
  const subMenuButtonStyles = cn(
    "flex min-w-0 items-center gap-3 rounded-lg px-3 py-1.5 text-sm outline-none",
    "transition-all duration-150 hover:bg-accent hover:text-accent-foreground",
    "focus-visible:ring-2 focus-visible:ring-ring",
    "[&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
    "text-muted-foreground"
  );

  // Render a single leaf menu item (no children)
  const renderMenuItem = (item: NavItem, isChild: boolean = false, isExpanded: boolean = true) => {
    const itemIsActive = isActive(item.href);
    const Icon = item.icon;

    // Child items (sub-menu)
    if (isChild) {
      return (
        <li className="relative">
          <Link
            href={item.href}
            onClick={(e) => handleItemClick(item, e)}
            className={cn(
              subMenuButtonStyles,
              itemIsActive
                ? "text-primary font-semibold border-l-2 border-primary bg-primary/8 px-2"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {item.badge}
              </span>
            )}
          </Link>
        </li>
      );
    }

    // Parent-level items — collapsed
    if (!isExpanded) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              onClick={(e) => handleItemClick(item, e)}
              className={cn(
                menuButtonStyles,
                "justify-center px-0 py-2",
                itemIsActive
                  ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary"
                  : "hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="size-[18px]" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            {item.label}
            {item.badge !== undefined && (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {item.badge}
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Link
        href={item.href}
        onClick={(e) => handleItemClick(item, e)}
        className={cn(
          menuButtonStyles,
          itemIsActive
            ? "bg-primary/8 text-primary font-semibold border-l-2 border-primary"
            : "hover:bg-accent hover:text-foreground"
        )}
      >
        <Icon className="size-[18px]" />
        <span>{item.label}</span>
        {item.badge !== undefined && (
          <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  // Render parent item with children (collapsible)
  const renderParentItem = (item: NavItemWithChildren, isExpanded: boolean = true) => {
    const isOpen = expandedId === item.id;
    const hasActiveChild = item.children?.some((child) => isActive(child.href));
    const Icon = item.icon;

    // Collapsed sidebar: show icon with tooltip containing children links
    if (!isExpanded) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => toggleExpanded(item.id)}
              className={cn(
                menuButtonStyles,
                "justify-center px-0 py-2",
                hasActiveChild
                  ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary"
                  : "hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="size-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex min-w-48 flex-col gap-1.5 p-3">
            <span className="mb-0.5 border-b border-border pb-1.5 text-sm font-semibold text-popover-foreground">
              {item.label}
            </span>
            {item.children?.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                onClick={(e) => handleItemClick(child, e)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-xs transition-colors",
                  isActive(child.href)
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-popover-foreground/80 hover:bg-accent/50 hover:text-popover-foreground"
                )}
              >
                {child.label}
              </Link>
            ))}
          </TooltipContent>
        </Tooltip>
      );
    }

    // Expanded sidebar: show collapsible menu
    return (
      <Collapsible open={isOpen} onOpenChange={() => toggleExpanded(item.id)}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              menuButtonStyles,
              hasActiveChild
                ? "bg-primary/8 text-primary font-semibold border-l-2 border-primary"
                : "hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="size-[18px]" />
            <span>{item.label}</span>
            <ChevronRight
              className={cn("ml-auto size-4 transition-transform duration-200", isOpen && "rotate-90")}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-border px-2.5 py-0.5 mt-1">
            {item.children?.map((child) => (
              <React.Fragment key={child.href}>{renderMenuItem(child, true)}</React.Fragment>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // Render all menu items
  const renderMenuItems = (isExpanded: boolean = true) => {
    return (
      <div className="flex w-full min-w-0 flex-col gap-1">
        {isExpanded && (
          <p className="px-3 pt-4 pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/40">
            Navigation
          </p>
        )}
        <ul className="flex w-full min-w-0 flex-col gap-1">
        {resolvedMenuItems.map((item) => {
          const hasChildren = !!(item.children && item.children.length > 0);

          if (hasChildren) {
            return (
              <li key={item.id} className="relative">
                {renderParentItem(item, isExpanded)}
              </li>
            );
          }

          // Leaf item (no children)
          if (item.href) {
            const leafItem: NavItem = {
              href: item.href,
              icon: item.icon,
              label: item.label,
              badge: item.badge,
            };

            return (
              <li key={item.id} className="relative">
                {renderMenuItem(leafItem, false, isExpanded)}
              </li>
            );
          }

          return null;
        })}
        </ul>
      </div>
    );
  };

  // Mobile Desktop Split:
  const sidebarContent = (
    <div className="flex h-full flex-col border-r bg-sidebar">
      {/* Logo Row */}
      <div className="flex h-[var(--layout-header-height)] shrink-0 items-center border-b border-border/50 px-4">
        {sidebarExpanded || isMobile || isTablet ? (
          <div className="flex w-full items-center gap-3 overflow-hidden">
            <div className="flex shrink-0 items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
              {logoIcon}
            </div>
            <div className="truncate text-base font-bold tracking-tight text-foreground/90">
              {logoText}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full">
            <div className="flex shrink-0 items-center justify-center size-9 rounded-lg bg-primary/10 text-primary">
              {logoIcon}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="custom-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-2">
        {renderMenuItems(sidebarExpanded || isMobile || isTablet)}
      </nav>

      {/* Toggle Button (Desktop only) */}
      {!isMobile && !isTablet && (
        <div className="shrink-0 border-t border-border p-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-full"
            onClick={toggleSidebar}
            aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarExpanded ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeft className="size-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );

  // Mobile/Tablet: Sheet overlay sidebar
  if (isMobile || isTablet) {
    return (
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[280px] p-0" hideCloseButton hideOverlay>
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <div className="flex h-full flex-col">
            {/* Mobile Custom Logo Header with X */}
            <div className="flex h-[var(--layout-header-height)] items-center border-b border-border px-3">
              <div className="flex shrink-0 items-center text-primary">{logoIcon}</div>
              {logoText && <div className="ml-2 flex-1 truncate font-bold text-primary">{logoText}</div>}
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto size-8 shrink-0"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2">{renderMenuItems(true)}</nav>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Fixed full-height sidebar
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-0 z-50 transition-[width] duration-300 ease-in-out",
          "hidden lg:flex lg:flex-col",
          sidebarExpanded
            ? "w-[var(--layout-sidebar-width-expanded)]"
            : "w-[var(--layout-sidebar-width-collapsed)]",
          className
        )}
      >
        {sidebarContent}
      </aside>
    </TooltipProvider>
  );
}
