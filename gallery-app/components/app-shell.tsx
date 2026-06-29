"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { GalleryHeader } from "@/components/gallery-header";

type Props = {
  children: React.ReactNode;
};

export function AppShell({ children }: Props) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      storageKey="vizi-gallery-theme"
    >
      <GalleryHeader />
      {children}
    </ThemeProvider>
  );
}
