import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  const base = SITE.url.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /checkout y /carrito no aportan valor a los buscadores (contienen
        // estado de sesion o formularios). /debug es la pagina de diagnostico
        // interna (ya tiene noindex a nivel de metadata; lo bloqueamos tambien
        // aca por si se olvida).
        disallow: ["/carrito", "/checkout", "/checkout/", "/debug"],
      },
    ],
    sitemap: [`${base}/sitemap.xml`, `${base}/producto/sitemap.xml`],
    host: base,
  };
}
