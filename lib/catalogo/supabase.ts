import { getSupabasePublic } from "../supabase/public";

/**
 * Datos de un producto que vienen de Supabase (no del ERP): foto y visibilidad.
 * Se cruzan por id_item con el catalogo del proxy.
 */
export interface ProductoExtra {
  foto_url: string | null;
  visible: boolean;
}

/**
 * Trae todos los registros de producto_extra en un solo query.
 * Se llama DENTRO del cache del catalogo para no golpear Supabase en cada
 * request y para que ERP + Supabase se refresquen a la vez.
 */
export async function fetchProductoExtras(): Promise<Map<string, ProductoExtra>> {
  const supabase = getSupabasePublic();
  const { data, error } = await supabase
    .from("producto_extra")
    .select("id_item, foto_url, visible");

  if (error) {
    throw new Error(`Supabase (producto_extra) fallo: ${error.message}`);
  }

  const map = new Map<string, ProductoExtra>();
  for (const row of data ?? []) {
    map.set(row.id_item, {
      foto_url: row.foto_url,
      visible: row.visible,
    });
  }
  return map;
}
