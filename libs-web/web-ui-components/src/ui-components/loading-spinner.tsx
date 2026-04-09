"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const SIZE_MAP = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function LoadingSpinner({ size = "md", label, className }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-8", className)}>
      <Loader2 className={cn("animate-spin text-muted-foreground", SIZE_MAP[size])} />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}
