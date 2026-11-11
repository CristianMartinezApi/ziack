import type { Metadata } from "next";
import { CartProvider } from "@/components/cart-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ziack — Joias para ser",
  description: "Joias para guardar histórias, celebrar encontros e revelar a beleza que sempre esteve aí.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full"><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
