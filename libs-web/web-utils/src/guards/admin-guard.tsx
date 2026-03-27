"use client";

import { useEffect, type ReactNode } from "react";
import { useAuth } from "../auth-provider";
import { useRouter } from "next/navigation";

export interface AdminGuardProps {
  children: ReactNode;
  /** Optional: URL to redirect if not admin */
  fallbackUrl?: string;
}

/**
 * AdminGuard ensures the user has the SUPER_ADMIN role.
 */
export function AdminGuard({ children, fallbackUrl = "/dashboard" }: AdminGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const isAdmin = user?.access?.isSuperAdmin === true;

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isAdmin) {
      router.push(fallbackUrl);
    }
  }, [isLoading, isAuthenticated, isAdmin, router, fallbackUrl]);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return <>{children}</>;
}
