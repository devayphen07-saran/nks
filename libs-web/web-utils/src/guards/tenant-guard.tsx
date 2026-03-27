"use client";

import { useEffect, type ReactNode } from "react";
import { useAuth } from "../auth-provider";
import { useRouter } from "next/navigation";

export interface TenantGuardProps {
  children: ReactNode;
  /** Optional: URL to redirect if no active store context */
  fallbackUrl?: string;
}

/**
 * TenantGuard ensures the user has an active store (tenant) context.
 * In NKS, this usually means the user is associated with at least one store.
 */
export function TenantGuard({
  children,
  fallbackUrl = "/select-store",
}: TenantGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // In NKS, if no active store, we might need a setup or selection
  const activeStoreId = user?.access?.activeStoreId;
  const hasStore = activeStoreId != null;

  useEffect(() => {
    if (!isLoading && isAuthenticated && !hasStore) {
      router.push(fallbackUrl);
    }
  }, [isLoading, isAuthenticated, hasStore, router, fallbackUrl]);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !hasStore) {
    return null;
  }

  return <>{children}</>;
}
