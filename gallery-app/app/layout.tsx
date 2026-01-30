import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="hr" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
