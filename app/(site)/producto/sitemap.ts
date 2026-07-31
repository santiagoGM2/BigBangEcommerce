import type { MetadataRoute } from "next";
import { getProductos } from "@/lib/catalogo";
import { SITE } from "@/lib/seo/site";

// Sitemap shardeado de todos los productos publicables. Cada shard cabe
// dentro del limite de 50k URLs / 50MB de Google. Con ~16k productos hoy
// cabemos en 4 shards de 5k.
//
// TRAMPA: en Next 16, `id` llega como Promise<number>, no como number,
// aunque la doc oficial aun lo tipe mal. Si no lo awaiteas, el rango
// da NaN y sitemap.xml responde 200 vacio sin ningun error visible.
// Ver CLAUDE.md > Trampas conocidas de Next 16.

const POR_SHARD = 5000;

export async function generateSitemaps() {
  const productos = await getProductos();
  const total = Math.max(1, Math.ceil(productos.length / POR_SHARD));
  return Array.from({ length: total }, (_, i) => ({ id: i }));
}

export default async function sitemap({
  id,
}: {
  // El id de generateSitemaps llega como Promise en Next 16 (ver arriba).
  id: Promise<number> | number;
}): Promise<MetadataRoute.Sitemap> {
  const shard = await id;
  const productos = await getProductos();
  const base = SITE.url.replace(/\/$/, "");
  const now = new Date();

  const inicio = shard * POR_SHARD;
  const fin = inicio + POR_SHARD;
  const slice = productos.slice(inicio, fin);

  return slice.map((p) => ({
    url: `${base}/producto/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));
}
