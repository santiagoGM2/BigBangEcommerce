import type { MetadataRoute } from "next";
import { FAMILIAS } from "@/lib/catalogo/familias-meta";
import { SITE } from "@/lib/seo/site";

// Sitemap plano: landing + 14 familias. Los productos van aparte en
// app/(site)/producto/sitemap.ts porque son ~16k URLs y necesitan
// generateSitemaps con shardeo.

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url.replace(/\/$/, "");
  const now = new Date();

  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/catalogo`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...FAMILIAS.map((f) => ({
      url: `${base}/catalogo/${f.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
