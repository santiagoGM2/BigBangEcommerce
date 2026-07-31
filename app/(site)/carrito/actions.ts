"use server";

import { resolverCarrito, type Snapshot } from "@/lib/carrito/resolver";
import type { CarritoResuelto, CartItem } from "@/lib/carrito/types";

/**
 * Server action que el cliente llama cada vez que el carrito cambia. Devuelve
 * el carrito ya resuelto contra el catalogo real (lineas con precios y
 * descripciones actuales) + avisos de cambios respecto al snapshot previo
 * si se proporciona.
 *
 * Validacion defensiva del input: llega desde el navegador, no confiamos.
 */
export async function accionResolverCarrito(
  itemsRaw: unknown,
  snapshotRaw?: unknown,
): Promise<CarritoResuelto> {
  const items = validarItems(itemsRaw);
  const snapshot = validarSnapshot(snapshotRaw);
  return resolverCarrito(items, snapshot);
}

function validarItems(x: unknown): CartItem[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter(
      (it): it is CartItem =>
        typeof it === "object" &&
        it !== null &&
        typeof (it as CartItem).id_item === "string" &&
        typeof (it as CartItem).cantidad === "number" &&
        (it as CartItem).cantidad > 0,
    )
    .slice(0, 200) // limite duro para no permitir cargas ridiculas
    .map((it) => ({
      id_item: it.id_item.slice(0, 32),
      cantidad: Math.min(99, Math.max(1, Math.floor(it.cantidad))),
    }));
}

function validarSnapshot(x: unknown): Snapshot[] | undefined {
  if (!Array.isArray(x)) return undefined;
  return x
    .filter(
      (s): s is Snapshot =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as Snapshot).id_item === "string" &&
        typeof (s as Snapshot).descripcion === "string" &&
        typeof (s as Snapshot).precio === "number",
    )
    .slice(0, 200);
}
