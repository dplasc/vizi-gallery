"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = (mounted ? resolvedTheme : "dark") === "dark";

  function handleToggle() {
    if (!mounted) return;
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="default"
      className="h-9 shrink-0 gap-2 border-2 border-border bg-card px-3 text-foreground shadow-sm hover:bg-muted"
      aria-label="Promijeni temu"
      title="Promijeni temu"
      onClick={handleToggle}
    >
      {isDark ? (
        <Sun className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Moon className="h-4 w-4 shrink-0" aria-hidden />
      )}
      <span className="text-sm font-medium">Tema</span>
    </Button>
  );
}
