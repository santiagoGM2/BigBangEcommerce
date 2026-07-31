"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useCart } from "@/lib/carrito/CartContext";
import { IconBag } from "@/components/landing/icons";

interface BuyNowButtonProps {
  idItem: string;
  className?: string;
}

/**
 * "Comprar ahora": agrega el producto al carrito y salta directo al checkout.
 * Pensado para el comprador que ya sabe qué quiere; el que aún duda usa
 * el boton "Agregar al carrito" y sigue navegando el catalogo.
 *
 * Se mantiene comportamiento add-and-go (no reemplaza el carrito): si ya
 * habia items del carrito, quedan intactos. Esto es lo esperado.
 */
export function BuyNowButton({ idItem, className = "" }: BuyNowButtonProps) {
  const { add } = useCart();
  const router = useRouter();
  const [saltando, startTransition] = useTransition();

  function handleClick() {
    add(idItem, 1);
    // useTransition avisa al boton mientras corre el prefetch/navigate,
    // asi mostramos feedback en la etiqueta y evitamos doble click.
    startTransition(() => {
      router.push("/checkout");
    });
  }

  // Familia visual: verde (hover verde oscuro). Distinta a la del boton
  // "Agregar al carrito" (rosa) para que en el detalle del producto se lea
  // sin dudar cual es cual: verde = "cerrar la compra ya".
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={saltando}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-verde px-6 py-4 text-base font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#5fa018] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
    >
      <IconBag width={18} height={18} />
      {saltando ? "Yendo al checkout..." : "Comprar ahora"}
    </button>
  );
}
