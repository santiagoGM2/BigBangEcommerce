"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/carrito/CartContext";

/**
 * Componente islote: al montar en la pagina de confirmacion, limpia el
 * carrito local. Se usa solo cuando el pedido quedo registrado en el
 * servidor exitosamente; asi el usuario no vuelve al catalogo con el mismo
 * carrito ya despachado.
 *
 * Se declara aparte para poder inyectarlo desde una pagina server sin
 * convertir la pagina entera en client.
 */
export function LimpiarCarritoAlMontar() {
  const { clear, isHydrated } = useCart();
  useEffect(() => {
    if (isHydrated) clear();
  }, [isHydrated, clear]);
  return null;
}
