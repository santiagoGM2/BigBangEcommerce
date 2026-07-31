"use client";

import { useState } from "react";
import { useCart } from "@/lib/carrito/CartContext";
import { IconCart } from "@/components/landing/icons";

interface AddToCartButtonProps {
  idItem: string;
  /** Estilo visual: "primary" es el CTA de producto detalle, "compact" el de tarjeta. */
  variant?: "primary" | "compact";
  /** Contenido personalizado. Por defecto "Agregar al carrito". */
  children?: React.ReactNode;
  className?: string;
}

export function AddToCartButton({
  idItem,
  variant = "primary",
  children,
  className = "",
}: AddToCartButtonProps) {
  const { add } = useCart();
  // Contador de clicks. Cada click hace pulseId++. Usamos el valor como
  // key={} en el elemento animado: React lo desmonta+remonta y la animacion
  // CSS de entrada se reinicia SIEMPRE, aunque el click anterior no haya
  // terminado de animarse. Sin esto, un usuario que clickea rapido veia
  // la animacion "trabada" y creia que sus clicks se perdian.
  const [pulseId, setPulseId] = useState(0);

  function handleClick(e: React.MouseEvent) {
    // El boton en las tarjetas del catalogo vive DENTRO de un <Link> al
    // detalle del producto. Sin esto, agregar al carrito tambien navegaria.
    e.preventDefault();
    e.stopPropagation();
    add(idItem, 1);
    setPulseId((n) => n + 1);
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label="Agregar al carrito"
        className={`relative inline-flex h-9 w-9 items-center justify-center overflow-visible rounded-full bg-rosa text-white shadow transition hover:bg-[#c4177a] ${className}`}
      >
        <IconCart width={16} height={16} strokeWidth={2.4} />
        {pulseId > 0 && (
          // Cada click monta un nuevo elemento con la anim "pulseUp"; el
          // key={pulseId} lo garantiza sin importar el timing.
          <span
            key={pulseId}
            className="bb-cart-pulse bb-cart-pulse--compact"
            aria-hidden="true"
          >
            +1
          </span>
        )}
      </button>
    );
  }

  // "primary" — CTA grande de la pagina de producto. Familia visual: rosa
  // (hover rosa oscuro). Se mantiene lejos del morado y verde que usan
  // BuyNow y otros CTAs, para que sea claro que rosa = "seguir sumando
  // al carrito".
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative inline-flex items-center justify-center gap-2 overflow-visible rounded-xl bg-rosa px-6 py-4 text-base font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#c4177a] hover:shadow-lg ${className}`}
    >
      <IconCart width={20} height={20} strokeWidth={2.4} />
      {children ?? "Agregar al carrito"}
      {pulseId > 0 && (
        <span
          key={`pulse-${pulseId}`}
          className="bb-cart-pulse bb-cart-pulse--primary"
          aria-hidden="true"
        >
          +1
        </span>
      )}
    </button>
  );
}
