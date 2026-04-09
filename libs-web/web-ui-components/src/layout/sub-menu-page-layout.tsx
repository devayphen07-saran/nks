"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "../lib/utils";
import { BreadcrumbNav } from "./breadcrumb-nav";
import type { SubMenuPageLayoutProps } from "./types";

export function SubMenuPageLayout({
  breadcrumb,
  title,
  subtitle,
  actions,
  subMenuItems,
  children,
}: SubMenuPageLayoutProps) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");

  const hasHeader = title || (breadcrumb && breadcrumb.length > 0) || actions;

  // Filter menu items based on search query
  const filteredItems = searchQuery
    ? subMenuItems.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : subMenuItems;

  return (
    <div className="flex flex-1 flex-col">
      {/* Page Header (not sticky in sub-menu layout) */}
      {hasHeader && (
        <div className="border-b border-border bg-background px-4 py-6 lg:px-6">
          {/* Breadcrumb */}
          {breadcrumb && breadcrumb.length > 0 && (
            <div className="mb-3">
              <BreadcrumbNav items={breadcrumb} />
            </div>
          )}

          {/* Title Row */}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              {title && <h1 className="truncate text-2xl font-bold tracking-tight lg:text-3xl">{title}</h1>}
              {subtitle && (
                <p className="mt-1 text-sm text-muted-foreground lg:text-base">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        </div>
      )}

      {/* Sub-menu + Content Area */}
      <div className="flex flex-1 overflow-hidden bg-muted/5 min-h-0">
        {/* Fixed Sub-menu (left side) */}
        <aside className="hidden w-56 shrink-0 border-r border-border bg-background h-full lg:flex lg:flex-col">
          {/* Search Input */}
          <div className="border-b border-border p-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded hover:bg-accent p-0.5"
                  aria-label="Clear search"
                >
                  <X className="size-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Menu Items */}
          <nav className="flex flex-col gap-1 overflow-y-auto p-4 flex-1 min-h-0">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {Icon && <Icon className="size-4 shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </Link>
              );
              })
            ) : (
              <div className="flex items-center justify-center py-8 text-center">
                <p className="text-sm text-muted-foreground">No results found</p>
              </div>
            )}
          </nav>
        </aside>

        {/* Mobile Sub-menu (horizontal scroll) */}
        <div className="flex border-b border-border bg-background px-4 lg:hidden">
          <nav className="flex gap-2 overflow-x-auto py-3 custom-scrollbar-hide">
            {subMenuItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-full px-5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="px-4 py-8 lg:px-8 max-w-7xl mx-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
