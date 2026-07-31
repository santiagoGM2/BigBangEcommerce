/**
 * Item guardado en el carrito. SOLO tiene id_item y cantidad — el precio,
 * la descripcion y demas datos se resuelven al render desde el catalogo
 * real (via server action resolverCarrito). Esto garantiza que si el
 * precio cambia en el ERP, el carrito refleja el nuevo precio; y si el
 * producto deja de existir, lo detectamos y avisamos al usuario.
 *
 * Es intencional que este archivo NO importe nada del server (esto se
 * comparte cliente/servidor).
 */
export interface CartItem {
  id_item: string;
  cantidad: number;
}

/**
 * Linea del carrito ya resuelta contra el catalogo real. Contiene todos
 * los datos derivados que la UI necesita para mostrarla.
 */
export interface CartLine {
  id_item: string;
  cantidad: number;
  descripcion: string;
  slug: string;
  precio_unitario: number;
  subtotal: number;
  foto_url: string | null;
  familia: string;
  familia_slug: string;
  precio_fuente: "publica" | "respaldo_mayorista";
}

/**
 * Aviso emitido por resolverCarrito cuando la revalidacion contra el
 * catalogo encuentra cambios respecto al ultimo estado conocido del
 * usuario. Se muestran arriba del carrito.
 */
export type CartAviso =
  | { tipo: "removido"; id_item: string; motivo: "no_existe" }
  | { tipo: "precio_cambio"; id_item: string; descripcion: string; anterior: number; nuevo: number };

/**
 * Resultado de resolver el carrito contra el catalogo real.
 */
export interface CarritoResuelto {
  lineas: CartLine[];
  subtotal: number;
  avisos: CartAviso[];
}
