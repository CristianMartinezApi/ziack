import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ziack — Joias para ser",
  description: "Joias para guardar histórias, celebrar encontros e revelar a beleza que sempre esteve aí.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
