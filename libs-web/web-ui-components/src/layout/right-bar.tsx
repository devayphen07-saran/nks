"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import type { QuickApp } from "./types";

interface RightBarProps {
  apps: QuickApp[];
  className?: string;
  onAddClick?: () => void;
}

export function RightBar({ apps, className, onAddClick }: RightBarProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "fixed bottom-0 right-0 top-[var(--layout-header-height)] z-40 hidden w-[var(--layout-rightbar-width)] flex-col bg-background lg:flex border-l",
          className
        )}
      >
        {/* App Icons */}
        <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto py-3">
          {apps.map((app, index) => {
            const Icon = app.icon;

            const iconButton = (
              <button
                onClick={app.onClick}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-accent",
                  app.color
                )}
              >
                <Icon className="size-5 text-white" />
              </button>
            );

            const content = app.href ? (
              <Link href={app.href} className="block">
                {iconButton}
              </Link>
            ) : (
              iconButton
            );

            return (
              <Tooltip key={`${app.label}-${index}`}>
                <TooltipTrigger asChild>{content}</TooltipTrigger>
                <TooltipContent side="left">{app.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Add Button at Bottom */}
        <div className="flex flex-col items-center py-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-lg"
                onClick={onAddClick}
              >
                <Plus className="size-5" />
                <span className="sr-only">Add app</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Add app</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
