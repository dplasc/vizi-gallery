"use client";

import { ThemeToggle } from "@/components/theme-toggle";

export function GalleryHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-3">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Galerija
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
