import type { FamiliaSlug } from "./familias-meta";

/**
 * Ruta al SVG placeholder de una familia con nombre + BIG BANG dentro
 * del SVG. Se usa en /catalogo y como fallback de productos sin foto.
 *
 * Este modulo es seguro para cliente. El helper que chequea el disco
 * (`fotoCategoriaSiExiste`) vive en placeholders.server.ts para no
 * arrastrar node:fs al bundle del navegador.
 */
export function placeholderFamilia(slug: FamiliaSlug): string {
  return `/catalogo/placeholders/${slug}.svg`;
}

/**
 * Ruta al SVG placeholder solo-icono (sin texto). Se usa en la seccion
 * "Categorias" de la landing, donde el nombre va debajo como texto HTML
 * y no queremos que aparezca dos veces.
 */
export function iconoFamilia(slug: FamiliaSlug): string {
  return `/catalogo/placeholders/${slug}-icon.svg`;
}
