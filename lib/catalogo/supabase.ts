import { getSupabasePublic } from "../supabase/public";
import type { ProductImage } from "./types";

/**
 * Datos de un producto que vienen de Supabase (no del ERP): foto y visibilidad.
 * Se cruzan por id_item con el catalogo del proxy.
 */
export interface ProductoExtra {
  foto_url: string | null;
  visible: boolean;
  images: ProductImage[];
}

/**
 * Trae todos los registros de producto_extra en un solo query.
 * Se llama DENTRO del cache del catalogo para no golpear Supabase en cada
 * request y para que ERP + Supabase se refresquen a la vez.
 */
export async function fetchProductoExtras(): Promise<Map<string, ProductoExtra>> {
  const supabase = getSupabasePublic();
  const map = new Map<string, ProductoExtra>();
  // La API limita cada respuesta a 1000 filas; pagina tambien las galerias.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("producto_extra")
      .select("id_item, foto_url, visible").order("id_item").range(offset, offset + 999);
    if (error) throw new Error(`Supabase (producto_extra) fallo: ${error.message}`);
    for (const row of data) map.set(row.id_item, { foto_url: row.foto_url, visible: row.visible, images: [] });
    if (data.length < 1000) break;
  }
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("producto_imagenes")
      .select("id_item, foto_url, orden").order("id_item").order("orden").range(offset, offset + 999);
    if (error) throw new Error(`Supabase (producto_imagenes) fallo: ${error.message}`);
    for (const row of data) map.get(row.id_item)?.images.push({ url: row.foto_url, order: row.orden });
    if (data.length < 1000) break;
  }
  for (const extra of map.values()) {
    if (!extra.images.length && extra.foto_url) extra.images.push({ url: extra.foto_url, order: 1 });
  }
  return map;
}
