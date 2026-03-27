"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { NavItemWithChildren } from "./types";

/**
 * Hook to manage app menus and active states
 */
export function useAppMenu(items: NavItemWithChildren[]) {
  const pathname = usePathname();

  // Find active items for breadcrumb or parent highlighting
  const activeItems = React.useMemo(() => {
    const active: NavItemWithChildren[] = [];

    // Helper to check if a path matches the current pathname
    const isPathActive = (path?: string) =>
      path && (pathname === path || pathname.startsWith(`${path}/`));

    items.forEach((item) => {
      // Check parent
      if (isPathActive(item.href)) {
        active.push(item);
      }

      // Check children
      if (item.children) {
        const activeChild = item.children.find((child) =>
          isPathActive(child.href),
        );
        if (activeChild) {
          active.push(item); // Add parent
          // Add child as a pseudo ItemWithChildren for generic handling
          active.push({ ...activeChild, id: activeChild.href || "" });
        }
      }
    });

    return active;
  }, [items, pathname]);

  return { activeItems, pathname };
}
