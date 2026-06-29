"use client";

import { ThemeToggle } from "@/components/theme-toggle";

export function GalleryHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card shadow-sm">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-6">
        <span className="text-sm font-semibold tracking-tight text-card-foreground">
          Galerija
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
