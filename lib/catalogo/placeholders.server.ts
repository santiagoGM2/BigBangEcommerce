import "server-only";

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { FamiliaSlug } from "./familias-meta";
import { FAMILIA_SLUGS } from "./familias-meta";

const DIR = join(process.cwd(), "public", "categorias");
const EXT = ".png";

/**
 * Devuelve la ruta a la foto personalizada de una familia en
 * `/public/categorias/{slug}.png` si el archivo existe en disco al momento
 * del render (SSR/build), o null si aun no fue subido. El cliente ira
 * agregando estas fotos con el tiempo; hasta que exista, las tarjetas de
 * familia caen automaticamente al iconoFamilia() correspondiente.
 *
 * Vive en un modulo `.server.ts` con `import "server-only"` para que
 * Turbopack rechace explicitamente cualquier import desde un client
 * component (evita arrastrar `node:fs` al bundle del navegador).
 */
export function fotoCategoriaSiExiste(slug: FamiliaSlug): string | null {
  // Efecto lateral util: la primera vez que se llama esta funcion en el
  // proceso, escaneamos el directorio y logueamos warnings sobre archivos
  // con nombres invalidos (no coinciden con ningun slug). Asi el equipo
  // detecta typos sin depender de una revision manual visual.
  validarNombresDeCategorias();

  const abs = join(DIR, `${slug}${EXT}`);
  return existsSync(abs) ? `/categorias/${slug}${EXT}` : null;
}

// ---------------------------------------------------------------------------
// Validador de nombres — memoizado a nivel de proceso
// ---------------------------------------------------------------------------

let yaValidado = false;

/**
 * Escanea /public/categorias/ y loguea warning por cada archivo cuyo nombre
 * no coincide con un slug de familia valido. Se ejecuta UNA vez por proceso
 * (o por build) via el flag `yaValidado`, para no ensuciar los logs.
 *
 * NO tira error ni bloquea el build — los archivos invalidos simplemente
 * no se sirven; el warning es para que el equipo los renombre.
 */
export function validarNombresDeCategorias(): void {
  if (yaValidado) return;
  yaValidado = true;
  try {
    if (!existsSync(DIR)) return;
    const validos = new Set<string>(FAMILIA_SLUGS);
    const entradas = readdirSync(DIR, { withFileTypes: true });

    const invalidos: string[] = [];
    for (const e of entradas) {
      if (!e.isFile()) continue;
      // Ignorar archivos ocultos (.DS_Store, .gitkeep, etc.)
      if (e.name.startsWith(".")) continue;
      // Aceptamos SOLO .png (convencion acordada). Otras extensiones
      // (jpg, webp, jpeg) tambien las flaggeamos porque no se sirven.
      if (!e.name.toLowerCase().endsWith(EXT)) {
        invalidos.push(`${e.name} (extension distinta a ${EXT})`);
        continue;
      }
      const slug = e.name.slice(0, -EXT.length);
      if (!validos.has(slug)) {
        invalidos.push(`${e.name} (slug "${slug}" no existe)`);
      }
    }

    if (invalidos.length > 0) {
      const validosLista = [...validos].sort().join(", ");
      console.warn(
        `[categorias] ${invalidos.length} archivo(s) en /public/categorias/ ` +
          `con nombre invalido — no se serviran hasta que se renombren:\n` +
          invalidos.map((n) => `    - ${n}`).join("\n") +
          `\n  Slugs validos: ${validosLista}`,
      );
    }
  } catch (err) {
    console.warn("[categorias] no se pudo validar el directorio:", err);
  }
}
