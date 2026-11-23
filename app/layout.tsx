import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "Blinko Studio | Diagnóstico e estruturação de negócios";
const description = "A Blinko investiga desafios empresariais, organiza prioridades e estrutura soluções integrando estratégia, comunicação e Relações Públicas.";

export const metadata: Metadata = {
  metadataBase: new URL("https://blinko-wine.vercel.app"),
  title,
  description,
  applicationName: "Blinko",
  keywords: [
    "diagnóstico empresarial",
    "estratégia empresarial",
    "estruturação de negócios",
    "comunicação estratégica",
    "relações públicas",
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
