"use client";

import * as React from "react";
import type { LayoutContextValue } from "./types";

const SIDEBAR_COOKIE_NAME = "layout_sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const SIDEBAR_KEYBOARD_SHORTCUT = "b";
const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

const LayoutContext = React.createContext<LayoutContextValue | null>(null);

export function useLayout() {
  const context = React.useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within a LayoutProvider.");
  }
  return context;
}

interface LayoutProviderProps {
  children: React.ReactNode;
  defaultSidebarExpanded?: boolean;
}

export function LayoutProvider({
  children,
  defaultSidebarExpanded = true,
}: LayoutProviderProps) {
  const [isMobile, setIsMobile] = React.useState(false);
  const [isTablet, setIsTablet] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [sidebarExpanded, _setSidebarExpanded] = React.useState(defaultSidebarExpanded);

  // Update sidebar state and persist to cookie
  const setSidebarExpanded = React.useCallback((expanded: boolean) => {
    _setSidebarExpanded(expanded);
    if (typeof document !== "undefined") {
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${expanded}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    }
  }, []);

  // Toggle sidebar (handles both desktop collapse and mobile menu)
  const toggleSidebar = React.useCallback(() => {
    if (isMobile || isTablet) {
      setMobileMenuOpen((open) => !open);
    } else {
      setSidebarExpanded(!sidebarExpanded);
    }
  }, [isMobile, isTablet, sidebarExpanded, setSidebarExpanded]);

  // Detect viewport size
  React.useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      setIsMobile(width < MOBILE_BREAKPOINT);
      setIsTablet(width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  // Keyboard shortcut to toggle sidebar (Ctrl/Cmd + B)
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  // Close mobile menu on escape key
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const contextValue = React.useMemo<LayoutContextValue>(
    () => ({
      sidebarExpanded,
      setSidebarExpanded,
      toggleSidebar,
      isMobile,
      isTablet,
      mobileMenuOpen,
      setMobileMenuOpen,
    }),
    [sidebarExpanded, setSidebarExpanded, toggleSidebar, isMobile, isTablet, mobileMenuOpen]
  );

  return <LayoutContext.Provider value={contextValue}>{children}</LayoutContext.Provider>;
}
