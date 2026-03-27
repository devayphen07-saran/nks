"use client"

import * as React from "react"
import { cn } from "../lib/utils"
import { Button, ButtonProps } from "../ui/button"

interface GradientButtonProps extends ButtonProps {
  gradient?: string;
}

export function GradientButton({
  gradient = "from-primary to-blue-600",
  className,
  children,
  ...props
}: GradientButtonProps) {
  return (
    <Button
      className={cn(
        "bg-gradient-to-r hover:opacity-90 transition-opacity font-bold shadow-lg",
        gradient,
        className
      )}
      {...props}
    >
      {children}
    </Button>
  )
}
