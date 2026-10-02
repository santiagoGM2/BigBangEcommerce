import type { FamiliaSlug } from "./familias-meta";

export interface ProductImage {
  url: string;
  order: number;
}

/**
 * Producto crudo devuelto por el proxy del catalogo.
 * El proxy devuelve EXACTAMENTE estos 9 campos, no hay mas.
 */
export interface ProductoProxy {
  /** Clave del producto en el ERP. Viene con ceros a la izquierda. SIEMPRE string. */
  id_item: string;
  /** Referencia comercial (en la mayoria de casos coincide con id_item). */
  referencia: string;
  /** Nombre del producto tal cual lo tiene el ERP, en MAYUSCULAS. */
  descripcion: string;
  /** Nombre crudo de la categoria del ERP. Clave de cruce con familias.ts. */
  categoria: string;
  /** Primer codigo de barra del producto. Puede ser corto. */
  codigo_barra: string;
  /** Precio en pesos colombianos, entero, sin decimales. */
  precio: number;
  /**
   * Origen del precio elegido por el proxy:
   *   "publica"              -> precio al publico
   *   "respaldo_mayorista"   -> este producto solo tiene lista mayorista
   */
  precio_fuente: "publica" | "respaldo_mayorista";
  /**
   * Stock disponible. Hoy SIEMPRE llega null: el proveedor del ERP aun no
   * expone este dato. Cuando llegue con numeros reales, ahi si construimos
   * "agotado" y deshabilitamos el boton de compra.
   */
  existencias: number | null;
  /**
   * true si el producto esta marcado como ACTIVO en el ERP. Se agrego al
   * contrato pero AUN NO FILTRAMOS por el, hay que confirmar con el cliente
   * que significan los estados del ERP antes de usarlo como criterio de
   * publicacion.
   */
  activo: boolean;
}

/**
 * Producto ya enriquecido con la info de Supabase (foto, visibilidad, nota)
 * y con la familia comercial resuelta.
 */
export interface ProductoEnriquecido extends ProductoProxy {
  familia: FamiliaSlug;
  /** URL de la foto en Supabase Storage, o null si aun no hay foto. */
  foto_url: string | null;
  images: ProductImage[];
  /** Slug canonico para la URL de detalle. */
  slug: string;
  /** Descripcion formateada para mostrar (capitalizada). */
  descripcion_mostrable: string;
  /** true si la categoria esta marcada CONFIRMAR en el CSV. */
  requiere_confirmacion: boolean;
}
