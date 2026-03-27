"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { BreadcrumbNav } from "./breadcrumb-nav";
import type { PageLayoutProps } from "./types";

export function PageLayout({
  breadcrumb,
  title,
  subtitle,
  actions,
  children,
}: PageLayoutProps) {
  const [isStuck, setIsStuck] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const hasHeader = title || (breadcrumb && breadcrumb.length > 0) || actions;

  // Use IntersectionObserver to detect when header becomes sticky
  React.useEffect(() => {
    if (!hasHeader) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsStuck(!entry.isIntersecting);
      },
      { threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasHeader]);

  // If no header content, just render children with padding
  if (!hasHeader) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex-1 px-4 py-4 pb-6 lg:px-6">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Sentinel element to detect scroll */}
      <div ref={sentinelRef} className="h-0 w-full" aria-hidden="true" />

      {/* Sticky Page Header */}
      <div
        className={cn(
          "sticky top-[var(--layout-header-height)] z-30 bg-background/95 backdrop-blur transition-all duration-200 supports-[backdrop-filter]:bg-background/60",
          isStuck && "border-b border-border shadow-sm",
        )}
      >
        <div
          className={cn(
            "px-4 lg:px-6 transition-all duration-200",
            isStuck ? "py-2" : "py-4",
          )}
        >
          {/* Breadcrumb (visible when not stuck, or always if no subtitle) */}
          {breadcrumb && breadcrumb.length > 0 && (
            <div
              className={cn(
                "transition-all duration-200",
                isStuck && subtitle
                  ? "h-0 overflow-hidden opacity-0 mb-0"
                  : "h-auto opacity-100 mb-2",
              )}
            >
              <BreadcrumbNav items={breadcrumb} />
            </div>
          )}

          {/* Title Row */}
          {(title || actions) && (
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                {/* Title */}
                {title && (
                  <h1
                    className={cn(
                      "truncate font-bold tracking-tight transition-all duration-200",
                      isStuck ? "text-base" : "text-2xl lg:text-3xl",
                    )}
                  >
                    {title}
                  </h1>
                )}

                {/* Subtitle (hidden when stuck) */}
                {subtitle && (
                  <p
                    className={cn(
                      "text-muted-foreground transition-all duration-200",
                      isStuck
                        ? "mt-0 h-0 overflow-hidden opacity-0"
                        : "mt-1 h-auto text-sm opacity-100",
                    )}
                  >
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Actions */}
              {actions && (
                <div className="flex shrink-0 items-center gap-2">
                  {actions}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 px-4 pb-6 lg:px-6 overflow-auto min-h-0">
        {children}
      </div>
    </div>
  );
}
