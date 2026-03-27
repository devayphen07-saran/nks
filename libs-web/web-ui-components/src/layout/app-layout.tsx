"use client";

import { cn } from "../lib/utils";
import { BottomNav } from "./bottom-nav";
import { LayoutProvider, useLayout } from "./context";
import { Header } from "./header";
import { LeftSidebar } from "./left-sidebar";
import { RightBar } from "./right-bar";

import type { AppLayoutProps } from "./types";

function AppLayoutContent({
  sidebar,
  header,
  quickApps,
  bottomNavItems,
  children,
}: AppLayoutProps) {
  const { sidebarExpanded, isMobile, isTablet } = useLayout();

  // Determine bottom nav items (default to first 5 sidebar items)
  const bottomItems = bottomNavItems ?? (sidebar.items?.slice(0, 5) ?? []);

  // Show right bar only on desktop (lg+)
  const showRightBar = !isMobile && !isTablet && quickApps && quickApps.length > 0;

  // Show bottom nav only on mobile
  const showBottomNav = isMobile;

  // Desktop mode (sidebar visible, not overlay)
  const isDesktop = !isMobile && !isTablet;

  return (
    <div className="relative min-h-svh w-full bg-background">
      {/* Left Sidebar (full height, contains logo) */}
      <LeftSidebar
        logoIcon={sidebar.logoIcon}
        logoText={sidebar.logoText}
        items={sidebar.items}
        menuItems={sidebar.menuItems}
        onMenuClick={sidebar.onMenuClick}
      />

      {/* Fixed Header (positioned after sidebar on desktop) */}
      <Header config={header} />

      {/* Right Bar (desktop only, full height) */}
      {showRightBar && <RightBar apps={quickApps} />}

      {/* Main Content Area */}
      <main
        className={cn(
          "min-h-svh transition-[padding] duration-300 ease-in-out",
          showBottomNav && "pb-[var(--layout-bottomnav-height)]"
        )}
        style={{
          paddingTop: "var(--layout-header-height)",
          paddingLeft: isDesktop
            ? sidebarExpanded
              ? "var(--layout-sidebar-width-expanded)"
              : "var(--layout-sidebar-width-collapsed)"
            : undefined,
          paddingRight: showRightBar ? "var(--layout-rightbar-width)" : undefined,
        }}
      >
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col">{children}</div>
        </div>
      </main>

      {/* Bottom Navigation (mobile only) */}
      {showBottomNav && <BottomNav items={bottomItems} />}
    </div>
  );
}

export function AppLayout(props: AppLayoutProps) {
  return (
    <LayoutProvider>
      <AppLayoutContent {...props} />
    </LayoutProvider>
  );
}
