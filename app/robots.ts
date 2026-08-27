import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/interno", "/api/"],
      },
    ],
    sitemap: "https://blinko-wine.vercel.app/sitemap.xml",
    host: "https://blinko-wine.vercel.app",
  };
}
