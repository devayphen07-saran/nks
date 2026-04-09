"use client";

import * as React from "react";
import { Badge } from "../ui/badge";
import { cn } from "../lib/utils";

type Status =
  | "active"
  | "inactive"
  | "blocked"
  | "deleted"
  | "pending"
  | "verified"
  | "unverified"
  | string;

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  active:     { label: "Active",     variant: "default",     className: "bg-emerald-500 hover:bg-emerald-500/80 border-transparent text-white" },
  inactive:   { label: "Inactive",   variant: "secondary" },
  blocked:    { label: "Blocked",    variant: "destructive" },
  deleted:    { label: "Deleted",    variant: "destructive" },
  pending:    { label: "Pending",    variant: "outline",     className: "text-amber-600 border-amber-300 bg-amber-50" },
  verified:   { label: "Verified",   variant: "default",     className: "bg-emerald-500 hover:bg-emerald-500/80 border-transparent text-white" },
  unverified: { label: "Unverified", variant: "secondary" },
};

interface StatusBadgeProps {
  status: Status;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const key = status.toLowerCase();
  const config = STATUS_CONFIG[key] ?? { label: status, variant: "outline" as const };

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {label ?? config.label}
    </Badge>
  );
}
