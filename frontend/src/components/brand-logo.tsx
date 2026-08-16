"use client";

import React from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  showText?: boolean;
}

export function BrandLogo({ className, imageClassName, showText = false }: BrandLogoProps) {
  const handleClick = () => {
    // Trigger background infrastructure sync on click
    api.post("/admin/infra/sync").catch(() => {});
  };

  return (
    <Link
      href="/"
      onClick={handleClick}
      className={cn("inline-flex items-center gap-2.5 hover:opacity-95 transition-opacity cursor-pointer", className)}
      title="Proxima — Refresh Dashboard & Sync Infra"
    >
      <div className="flex items-center justify-center rounded-lg p-2 transition-colors bg-transparent dark:bg-white dark:shadow-sm">
        <img
          src="/DarkLogo.png"
          alt="Proxima Logo"
          className={cn("h-10 w-auto object-contain max-h-12", imageClassName)}
        />
      </div>
      {showText && <span className="font-semibold text-lg tracking-tight">Proxima</span>}
    </Link>
  );
}

export function BrandIcon({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <Link href="/" className="inline-block hover:opacity-90 transition-opacity">
      <img
        src="/icon-rounded.png"
        alt="Proxima Icon"
        style={{ width: size, height: size }}
        className={cn("rounded-lg object-contain shrink-0", className)}
      />
    </Link>
  );
}
