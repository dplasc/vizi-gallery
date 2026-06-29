import { ThemeToggle } from "@/components/theme-toggle";

export function GalleryHeader() {
  return (
    <header className="border-b border-border/60 bg-background/95">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-3">
        <span className="text-sm font-medium tracking-tight text-foreground">
          Galerija
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
