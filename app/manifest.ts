import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Blinko",
    short_name: "Blinko",
    description: "Diagnóstico e estruturação de negócios, integrando comunicação estratégica e Relações Públicas.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3efeb",
    theme_color: "#01301e",
    lang: "pt-BR",
    icons: [
      {
        src: "/brand/monograma-b-rosa.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
