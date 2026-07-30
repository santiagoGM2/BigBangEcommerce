/**
 * Utilidades de formato para mostrar datos del catalogo al usuario.
 */

const FORMATO_COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** Formatea un entero en pesos colombianos: 12000 -> "$12.000". */
export function formatearPrecio(pesos: number): string {
  return FORMATO_COP.format(pesos);
}

// Palabras que no se capitalizan cuando estan en el interior de la descripcion.
const MINUSCULAS_INTERIOR = new Set([
  "de", "del", "la", "las", "el", "los", "y", "o", "u", "e", "en",
  "para", "por", "con", "sin", "a", "al", "un", "una", "unos", "unas",
]);

/**
 * Convierte una descripcion del ERP en algo presentable:
 * "GLOBO SEMP R9 LISA SURTIDA/12 X UND" -> "Globo Semp R9 Lisa Surtida/12 X Und".
 *
 * Preserva "/" y numeros. La primera palabra siempre va capitalizada.
 * Las palabras de la lista de conectores van en minuscula excepto al inicio.
 */
export function capitalizarDescripcion(raw: string): string {
  const lower = raw.toLowerCase();
  return lower.replace(/[a-zñáéíóú0-9]+/g, (palabra, offset: number) => {
    if (offset > 0 && MINUSCULAS_INTERIOR.has(palabra)) {
      return palabra;
    }
    // Preservar tokens que son puros numeros o alfanumericos cortos como codigos
    // (R9, X, UND). Los dejamos capitalizados de forma simple.
    const primera = palabra.charAt(0).toUpperCase();
    return primera + palabra.slice(1);
  });
}
