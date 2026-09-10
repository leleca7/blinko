import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "Blinko | Diagnóstico empresarial, estratégia e execução";
const description = "A Blinko investiga gargalos, valida prioridades e executa soluções sob medida em marca, marketing, atendimento, operação, gestão e tecnologia — com acompanhamento.";

export const metadata: Metadata = {
  metadataBase: new URL("https://blinko-wine.vercel.app"),
  title,
  description,
  applicationName: "Blinko",
  keywords: [
    "diagnóstico empresarial",
    "estratégia empresarial",
    "consultoria de negócios",
    "marketing e branding",
    "processos e operação",
    "automação e IA",
    "gestão e indicadores",
    "experiência do cliente",
  ],
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title,
    description,
    url: "/",
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
