"use client";

import { useCart } from "@/lib/carrito/CartContext";
import {
  IconCart,
  IconMinus,
  IconPlus,
  IconTrash,
} from "@/components/landing/icons";

interface AddToCartButtonProps {
  idItem: string;
  /** Estilo visual: "primary" es el CTA de producto detalle, "compact" el de tarjeta. */
  variant?: "primary" | "compact";
  /** Contenido personalizado del boton inicial. Por defecto "Agregar al carrito". */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Boton "Agregar al carrito" con estados sincronizados al carrito global.
 *
 *  - Cantidad 0  -> boton normal "Agregar al carrito"
 *  - Cantidad ≥1 -> stepper inline [− o basura] [cantidad] [+]
 *
 * La cantidad viene de useCart() (LocalStorage + Context), asi que el
 * mismo producto muestra la misma cantidad estén donde estén los botones
 * (tarjeta del catalogo, pagina de detalle, etc). Cambios en un boton
 * se reflejan al instante en el otro.
 *
 * El icono de la izquierda:
 *  - cantidad === 1 -> basura (siguiente click quita del carrito)
 *  - cantidad ≥ 2   -> menos (siguiente click resta 1)
 */
export function AddToCartButton({
  idItem,
  variant = "primary",
  children,
  className = "",
}: AddToCartButtonProps) {
  const { items, add, setQty, remove, isHydrated } = useCart();
  const cantidad = items.find((i) => i.id_item === idItem)?.cantidad ?? 0;

  // Antes de hidratar, el server NUNCA sabe que hay en el carrito. Para
  // evitar mismatch renderizamos el boton "Agregar" (estado default) y al
  // hidratar, si en el LocalStorage habia unidades, el stepper aparece.
  const showStepper = isHydrated && cantidad > 0;

  // Handler unico para todos los botones DENTRO del componente. Los botones
  // en las tarjetas del catalogo viven bajo un <Link>; sin preventDefault
  // + stopPropagation cualquier click navegaria al detalle del producto.
  function safe(e: React.MouseEvent, fn: () => void) {
    e.preventDefault();
    e.stopPropagation();
    fn();
  }

  if (variant === "compact") {
    if (!showStepper) {
      return (
        <button
          type="button"
          onClick={(e) => safe(e, () => add(idItem, 1))}
          aria-label="Agregar al carrito"
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-rosa text-white shadow transition hover:bg-[#c4177a] ${className}`}
        >
          <IconCart width={16} height={16} strokeWidth={2.4} />
        </button>
      );
    }
    return (
      <div
        className={`bb-stepper bb-stepper--compact ${className}`}
        // El div en si no navega; los botones ya paran propagacion, pero
        // duplicamos aca por si el usuario clickea el gap entre botones.
        onClick={(e) => e.stopPropagation()}
        role="group"
        aria-label={`Cantidad en carrito: ${cantidad}`}
      >
        <button
          type="button"
          onClick={(e) => safe(e, () => (cantidad === 1 ? remove(idItem) : setQty(idItem, cantidad - 1)))}
          aria-label={cantidad === 1 ? "Quitar del carrito" : "Restar uno"}
          className="bb-stepper-btn"
        >
          {cantidad === 1 ? (
            <IconTrash width={14} height={14} />
          ) : (
            <IconMinus width={14} height={14} />
          )}
        </button>
        <span className="bb-stepper-count" aria-live="polite">
          {cantidad}
        </span>
        <button
          type="button"
          onClick={(e) => safe(e, () => setQty(idItem, cantidad + 1))}
          aria-label="Sumar uno"
          className="bb-stepper-btn"
          disabled={cantidad >= 99}
        >
          <IconPlus width={14} height={14} />
        </button>
      </div>
    );
  }

  // ---- primary ----
  if (!showStepper) {
    return (
      <button
        type="button"
        onClick={(e) => safe(e, () => add(idItem, 1))}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-rosa px-6 py-4 text-base font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#c4177a] hover:shadow-lg ${className}`}
      >
        <IconCart width={20} height={20} strokeWidth={2.4} />
        {children ?? "Agregar al carrito"}
      </button>
    );
  }
  return (
    <div
      className={`bb-stepper bb-stepper--primary ${className}`}
      role="group"
      aria-label={`Cantidad en carrito: ${cantidad}`}
    >
      <button
        type="button"
        onClick={(e) => safe(e, () => (cantidad === 1 ? remove(idItem) : setQty(idItem, cantidad - 1)))}
        aria-label={cantidad === 1 ? "Quitar del carrito" : "Restar uno"}
        className="bb-stepper-btn"
      >
        {cantidad === 1 ? (
          <IconTrash width={20} height={20} />
        ) : (
          <IconMinus width={20} height={20} />
        )}
      </button>
      <span className="bb-stepper-count" aria-live="polite">
        {cantidad}
      </span>
      <button
        type="button"
        onClick={(e) => safe(e, () => setQty(idItem, cantidad + 1))}
        aria-label="Sumar uno"
        className="bb-stepper-btn"
        disabled={cantidad >= 99}
      >
        <IconPlus width={20} height={20} />
      </button>
    </div>
  );
}
