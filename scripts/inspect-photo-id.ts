import "server-only";
import { resolve } from "node:path";
import { config } from "dotenv";
import { fetchPhotoCatalogIds } from "./product-images/catalog";
import type { ProductoProxy } from "../lib/catalogo/types";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const normalize = (value: string) => value.replace(/^0+(?=\d)/, "");

async function main() {
  const searchedId = process.env.PHOTO_ID_TO_INSPECT?.trim() ?? "";
  if (!/^\d{1,20}$/.test(searchedId)) throw new Error("PHOTO_ID_TO_INSPECT debe ser un ID numerico.");
  const base = process.env.CATALOGO_API_BASE;
  const key = process.env.CATALOGO_API_KEY;
  if (!base || !key) throw new Error("Falta configurar el acceso al catalogo.");
  const ids = await fetchPhotoCatalogIds();
  const aliases = [...ids].filter(id => normalize(id) === normalize(searchedId));
  const url = new URL("productos", `${base.replace(/\/$/, "")}/`);
  const response = await fetch(url, { headers: { "x-api-key": key, accept: "application/json" },
    signal: AbortSignal.timeout(45_000), cache: "no-store" });
  if (!response.ok) throw new Error(`Catalogo de productos respondio HTTP ${response.status}.`);
  const products = await response.json() as ProductoProxy[];
  if (!Array.isArray(products) || products.some(product => typeof product.id_item !== "string")) {
    throw new Error("Respuesta de productos incompleta o invalida.");
  }
  const matches = products.filter(product =>
    normalize(product.id_item) === normalize(searchedId) ||
    normalize(product.referencia ?? "") === normalize(searchedId) ||
    normalize(product.codigo_barra ?? "") === normalize(searchedId));
  const center = Number(normalize(searchedId));
  const neighborhood = products.filter(product => {
    const numeric = Number(normalize(product.id_item));
    return Number.isInteger(numeric) && numeric >= center - 3 && numeric <= center + 3;
  });
  console.log(JSON.stringify({ searchedId, catalogIdCount: ids.size, productCount: products.length,
    exactId: ids.has(searchedId), aliases, matches: matches.map(product => ({
      id_item: product.id_item, referencia: product.referencia, codigo_barra: product.codigo_barra,
      descripcion: product.descripcion, categoria: product.categoria,
    })), neighborhood: neighborhood.map(product => ({
      id_item: product.id_item, referencia: product.referencia,
      descripcion: product.descripcion, categoria: product.categoria,
    })) }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
