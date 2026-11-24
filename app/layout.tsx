import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "Blinko Studio | Diagnóstico e estruturação de negócios";
const description = "A Blinko investiga desafios empresariais, organiza prioridades e estrutura soluções integrando estratégia, comunicação e Relações Públicas.";

export const metadata: Metadata = {
  metadataBase: new URL("https://blinko-imersiva.vercel.app"),
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
  icons: { icon: [{ url: "/brand/monograma-b-rosa.svg", type: "image/svg+xml" }], apple: "/brand/monograma-b-rosa.svg" },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Blinko",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "https://blinko-imersiva.vercel.app/opengraph-image", width: 1200, height: 630, alt: "Blinko — O problema nem sempre está onde parece." }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [{ url: "/opengraph-image", alt: "Blinko — O problema nem sempre está onde parece." }],
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
