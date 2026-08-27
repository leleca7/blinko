import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blinko — Inovação aplicada ao problema real",
  description:
    "A Blinko organiza sinais, investiga hipóteses, valida prioridades e executa intervenções com acompanhamento.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
