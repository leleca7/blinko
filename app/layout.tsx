import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "Blinko | Inovação aplicada ao problema real";
const description = "A Blinko organiza sinais, investiga hipóteses, valida prioridades e executa intervenções com acompanhamento.";

export const metadata: Metadata = {
  metadataBase: new URL("https://blinko-wine.vercel.app"),
  title,
  description,
  applicationName: "Blinko",
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title,
    description,
    siteName: "Blinko",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#01301e",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
