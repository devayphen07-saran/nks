"use client";

import { useEffect, type ReactNode } from "react";
import { useAuth } from "../auth-provider";
import { useRouter } from "next/navigation";

export interface AppGuardProps {
  children: ReactNode;
  /** Optional: URL to redirect if not authenticated */
  fallbackUrl?: string;
}

/**
 * AppGuard ensures the user is authenticated before accessing the children.
 * If not authenticated, it redirects to the fallback URL (usually login).
 */
export function AppGuard({ children, fallbackUrl = "/login" }: AppGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(fallbackUrl);
    }
  }, [isLoading, isAuthenticated, router, fallbackUrl]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center font-outfit">
        <div className="animate-pulse text-muted-foreground">Initializing session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
