import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { FamiliaSlug } from "./familias-meta";

/**
 * Devuelve la ruta a la foto personalizada de una familia en
 * `/public/categorias/{slug}.png` si el archivo existe en disco al momento
 * del render (SSR/build), o null si aun no fue subido. El cliente ira
 * agregando estas fotos con el tiempo; hasta que exista, la seccion
 * "Categorias" cae automaticamente al iconoFamilia() correspondiente.
 *
 * Vive en un modulo `.server.ts` con `import "server-only"` para que
 * Turbopack rechace explicitamente cualquier import desde un client
 * component (evita arrastrar `node:fs` al bundle del navegador).
 */
export function fotoCategoriaSiExiste(slug: FamiliaSlug): string | null {
  const abs = join(process.cwd(), "public", "categorias", `${slug}.png`);
  return existsSync(abs) ? `/categorias/${slug}.png` : null;
}
