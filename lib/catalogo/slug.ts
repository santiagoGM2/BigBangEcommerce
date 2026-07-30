/**
 * Slug canonico de un producto: `descripcion-normalizada-id_item`.
 * El id_item al final es lo unico que garantiza unicidad — la descripcion
 * puede repetirse entre productos distintos del ERP.
 */

export function slugify(descripcion: string, idItem: string): string {
  const base = normalizarTexto(descripcion);
  return `${base}-${idItem}`;
}

/**
 * Extrae el id_item del final del slug. Devuelve null si el slug no tiene el
 * formato esperado (por si llega basura desde el navegador).
 *
 * El id_item es una secuencia de digitos al final del slug. Los slugs siempre
 * llevan al menos un guion antes del id_item porque van despues de la
 * descripcion normalizada.
 */
export function extraerIdItem(slug: string): string | null {
  const match = slug.match(/-(\d+)$/);
  return match ? match[1]! : null;
}

/**
 * Normaliza un texto para incluirlo en una URL:
 * minusculas, sin tildes, sin caracteres raros, sin guiones repetidos.
 *
 * Colapsar guiones repetidos es CRITICO: sin eso, una descripcion como
 * "GLOBO SEMP R9 LISA SURTIDA/12 X UND" queda como
 * "globo-semp-r9--lisa-surtida--12" (con dobles guiones porque "/" y espacios
 * adyacentes generan cada uno un guion).
 */
export function normalizarTexto(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining diacritical marks (tildes) que quedan tras NFD
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-") // cualquier caracter no alfanumerico -> guion
    .replace(/-+/g, "-") // colapsa guiones repetidos
    .replace(/^-|-$/g, ""); // sin guion inicial ni final
}
