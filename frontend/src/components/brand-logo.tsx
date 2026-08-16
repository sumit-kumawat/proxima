import React from "react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  showText?: boolean;
}

export function BrandLogo({ className, imageClassName, showText = false }: BrandLogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      {/* 
        The logo is dark text/graphic. 
        In light mode (or on transparent cards on light bg), it remains transparent.
        In dark mode, it automatically renders inside a clean white card background to stay visible.
      */}
      <div className="flex items-center justify-center rounded-lg p-2 transition-colors bg-transparent dark:bg-white dark:shadow-sm">
        <img
          src="/DarkLogo.png"
          alt="Proxima Logo"
          className={cn("h-10 w-auto object-contain max-h-12", imageClassName)}
        />
      </div>
      {showText && <span className="font-semibold text-lg tracking-tight">Proxima</span>}
    </div>
  );
}

export function BrandIcon({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <img
      src="/icon-rounded.png"
      alt="Proxima Icon"
      style={{ width: size, height: size }}
      className={cn("rounded-lg object-contain shrink-0", className)}
    />
  );
}
