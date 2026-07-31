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
  const [feedback, setFeedback] = useState(false);

  function handleClick(e: React.MouseEvent) {
    // El boton en las tarjetas del catalogo vive DENTRO de un <Link> al
    // detalle del producto. Sin esto, agregar al carrito tambien navegaria.
    e.preventDefault();
    e.stopPropagation();
    add(idItem, 1);
    setFeedback(true);
    setTimeout(() => setFeedback(false), 1400);
  }

  if (variant === "compact") {
    // Version para las tarjetas del grid: icono + tooltip breve.
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label="Agregar al carrito"
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-rosa text-white shadow transition hover:bg-[#c4177a] ${
          feedback ? "!bg-verde" : ""
        } ${className}`}
      >
        {feedback ? (
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <IconCart width={16} height={16} strokeWidth={2.4} />
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
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-rosa px-6 py-4 text-base font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#c4177a] hover:shadow-lg ${
        feedback ? "!bg-verde" : ""
      } ${className}`}
    >
      {feedback ? (
        <>
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Agregado
        </>
      ) : (
        <>
          <IconCart width={20} height={20} strokeWidth={2.4} />
          {children ?? "Agregar al carrito"}
        </>
      )}
    </button>
  );
}
