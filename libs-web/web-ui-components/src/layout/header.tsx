"use client";

import * as React from "react";
import {
  Search,
  Bell,
  Menu,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";
import { useLayout } from "./context";
import type { HeaderConfig } from "./types";

interface HeaderProps {
  config: HeaderConfig;
  className?: string;
}

export function Header({ config, className }: HeaderProps) {
  const {
    sidebarExpanded,
    isMobile,
    isTablet,
    setMobileMenuOpen,
  } = useLayout();

  // Calculate left offset based on sidebar state (desktop only)
  const isDesktop = !isMobile && !isTablet;

  return (
    <header
      className={cn(
        "fixed right-0 top-0 z-40 flex h-[var(--layout-header-height)] shrink-0 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-[left] duration-300 ease-in-out",
        !isDesktop && "left-0",
        className,
      )}
      style={isDesktop ? {
        left: sidebarExpanded
          ? "var(--layout-sidebar-width-expanded)"
          : "var(--layout-sidebar-width-collapsed)",
      } : undefined}
    >
      <div className="flex w-full items-center gap-2 md:gap-3 px-3 lg:px-4">
        {/* Hamburger Menu (Mobile/Tablet only) */}
        {!isDesktop && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>
            <Separator orientation="vertical" className="h-5" />
          </>
        )}

        {/* Search */}
        {config.showSearch && (
          <div className="hidden md:flex">
            <div className="relative w-[320px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder={config.searchPlaceholder ?? "Search..."}
                className="h-9 w-full pl-9"
              />
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Company Switcher */}
        {config.companySwitcher && (
          <div className="shrink-0">{config.companySwitcher}</div>
        )}

        {/* Mobile Actions - Notification & Profile */}
        {!isDesktop && (
          <div className="flex shrink-0 items-center gap-1">
            {config.notifications && (
              <div className="shrink-0">{config.notifications}</div>
            )}
            {config.profileDrawer && (
              <div className="shrink-0">{config.profileDrawer}</div>
            )}
          </div>
        )}

        {/* Desktop Actions */}
        {isDesktop && (
          <div className="flex shrink-0 items-center gap-4">
            {config.rightContent}
            {config.notifications && (
              <div className="shrink-0 flex items-center justify-center p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                {config.notifications}
              </div>
            )}
            {config.profileDrawer && (
              <div className="shrink-0 pl-2 border-l border-border/50">
                {config.profileDrawer}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
