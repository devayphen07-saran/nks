"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <div className="flex flex-1 flex-col">
      {/* Page Header (not sticky in sub-menu layout) */}
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
            <h1 className="truncate text-2xl font-bold tracking-tight lg:text-3xl">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground lg:text-base">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </div>

      {/* Sub-menu + Content Area */}
      <div className="flex flex-1 overflow-hidden bg-muted/5">
        {/* Fixed Sub-menu (left side) */}
        <aside className="hidden w-56 shrink-0 border-r border-border bg-background lg:block">
          <nav className="sticky top-0 flex flex-col gap-1 overflow-y-auto p-4">
            {subMenuItems.map((item) => {
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
            })}
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
