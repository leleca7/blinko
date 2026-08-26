import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blinko — Inovação aplicada ao problema real",
  description:
    "A Blinko diagnostica empresas, encontra gargalos e implanta as soluções certas para evoluir o negócio.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
