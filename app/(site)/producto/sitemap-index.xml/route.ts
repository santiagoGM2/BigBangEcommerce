import { getProductos } from "@/lib/catalogo";
import { SITE } from "@/lib/seo/site";

export const dynamic = "force-dynamic";

/** generateSitemaps genera fragmentos; este índice los anuncia a robots.txt. */
export async function GET() {
  const products = await getProductos();
  const count = Math.max(1, Math.ceil(products.length / 5000));
  const base = SITE.url.replace(/\/$/, "");
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const entries = Array.from({ length: count }, (_, index) =>
    `<sitemap><loc>${escape(`${base}/producto/sitemap/${index}.xml`)}</loc></sitemap>`,
  ).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
