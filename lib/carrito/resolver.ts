import "server-only";

import { getProductoPorId } from "@/lib/catalogo";
import { FAMILIAS_BY_SLUG } from "@/lib/catalogo/familias-meta";
import type { CartItem, CarritoResuelto } from "./types";

/**
 * Snapshot con el precio que la UI tenia grabado la ultima vez que resolvio
 * el carrito. Se guarda en localStorage aparte del carrito canonico (que
 * solo lleva id_item + cantidad) para poder detectar cambios entre visitas.
 */
export interface Snapshot {
  id_item: string;
  descripcion: string;
  precio: number;
}

/**
 * Resuelve una lista de items del carrito contra el catalogo real en vivo.
 *
 * Regla de oro: NUNCA confiar en el precio o descripcion que
 * viene del cliente. Todo se recalcula aca desde getProductoPorId().
 * El client puede pasar un snapshot con el precio que TENIA guardado; lo
 * usamos SOLO para emitir avisos "el precio cambio" o para detectar
 * remocion, no como fuente de verdad.
 */
export async function resolverCarrito(
  items: CartItem[],
  snapshotAnterior?: Snapshot[],
): Promise<CarritoResuelto> {
  const resultado: CarritoResuelto = { lineas: [], subtotal: 0, avisos: [] };
  const snapshotPorId = new Map(
    (snapshotAnterior ?? []).map((s) => [s.id_item, s] as const),
  );

  // Resolvemos en paralelo contra el catalogo cacheado.
  const resueltos = await Promise.all(
    items.map(async (it) => ({ it, prod: await getProductoPorId(it.id_item) })),
  );

  for (const { it, prod } of resueltos) {
    if (!prod) {
      resultado.avisos.push({ tipo: "removido", id_item: it.id_item, motivo: "no_existe" });
      continue;
    }

    const cantidad = Math.max(1, Math.floor(it.cantidad));
    const subtotal = prod.precio * cantidad;
    const familia = FAMILIAS_BY_SLUG[prod.familia];

    const anterior = snapshotPorId.get(it.id_item);
    if (anterior && anterior.precio !== prod.precio) {
      resultado.avisos.push({
        tipo: "precio_cambio",
        id_item: it.id_item,
        descripcion: prod.descripcion_mostrable,
        anterior: anterior.precio,
        nuevo: prod.precio,
      });
    }

    resultado.lineas.push({
      id_item: prod.id_item,
      cantidad,
      descripcion: prod.descripcion_mostrable,
      slug: prod.slug,
      precio_unitario: prod.precio,
      subtotal,
      foto_url: prod.foto_url,
      familia: familia.nombre,
      familia_slug: prod.familia,
      precio_fuente: prod.precio_fuente,
    });
    resultado.subtotal += subtotal;
  }

  return resultado;
}
