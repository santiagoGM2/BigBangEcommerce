import type { FamiliaSlug } from "./familias-meta";

/**
 * Ruta al SVG placeholder de una familia. Cuando un producto no tiene
 * foto_url en Supabase se muestra el placeholder de su familia.
 * Nunca un espacio vacio ni un icono roto.
 *
 * Los SVG viven en public/catalogo/placeholders/{slug}.svg y comparten diseno.
 */
export function placeholderFamilia(slug: FamiliaSlug): string {
  return `/catalogo/placeholders/${slug}.svg`;
}
