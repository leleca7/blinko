import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Blinko",
    short_name: "Blinko",
    description: "Diagnóstico, execução e acompanhamento aplicados ao problema real da empresa.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3efeb",
    theme_color: "#01301e",
    lang: "pt-BR",
    icons: [
      {
        src: "/brand/flor-centro.webp",
        sizes: "any",
        type: "image/webp",
      },
    ],
  };
}
