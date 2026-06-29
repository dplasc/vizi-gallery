import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { GalleryHeader } from "@/components/gallery-header";

export const metadata: Metadata = {
  title: "Galerija — Vizi.hr",
  description: "Moji albumi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hr" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <GalleryHeader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
