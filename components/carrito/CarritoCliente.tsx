"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { accionResolverCarrito } from "@/app/(site)/carrito/actions";
import { useCart } from "@/lib/carrito/CartContext";
import { formatearPrecio } from "@/lib/catalogo/formato";
import { placeholderFamilia } from "@/lib/catalogo/placeholders";
import type { CarritoResuelto, CartItem } from "@/lib/carrito/types";
import type { FamiliaSlug } from "@/lib/catalogo/familias-meta";
import type { Snapshot } from "@/lib/carrito/resolver";

const SNAPSHOT_KEY = "bb_cart_snapshot_v1";
const EMPTY_CART: CarritoResuelto = { lineas: [], subtotal: 0, avisos: [] };

function leerSnapshot(): Snapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function guardarSnapshot(lineas: CarritoResuelto["lineas"]) {
  if (typeof window === "undefined") return;
  const snap: Snapshot[] = lineas.map((l) => ({
    id_item: l.id_item,
    descripcion: l.descripcion,
    precio: l.precio_unitario,
  }));
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
  } catch {
    /* silencioso */
  }
}

export function CarritoCliente() {
  const { items, isHydrated, setQty, remove, clear } = useCart();
  const [resolvedCart, setResolvedCart] = useState<CarritoResuelto | null>(null);
  const [settledItems, setSettledItems] = useState<CartItem[] | null>(null);
  const [avisosDismissed, setAvisosDismissed] = useState(false);
  const resuelto = items.length === 0 ? EMPTY_CART : resolvedCart;
  const cargando = isHydrated && items.length > 0 && settledItems !== items;
  // Cada request al server tiene un "id de intento" ascendente. Cuando llega
  // una respuesta, solo la aplicamos si sigue siendo la mas reciente: asi
  // evitamos pisar el estado con una respuesta vieja si el usuario toca +/-
  // varias veces seguidas.
  const attemptRef = useRef(0);

  useEffect(() => {
    const myAttempt = ++attemptRef.current;
    if (!isHydrated || items.length === 0) return;
    const snap = leerSnapshot();
    accionResolverCarrito(items, snap)
      .then((r) => {
        if (myAttempt !== attemptRef.current) return;
        setResolvedCart(r);
        // Auto-remocion: si el catalogo dice que un id ya no existe, lo
        // sacamos del context (y por tanto del localStorage).
        const removidos = r.avisos.filter((a) => a.tipo === "removido");
        if (removidos.length > 0) {
          removidos.forEach((a) => remove(a.id_item));
        }
        guardarSnapshot(r.lineas);
        setAvisosDismissed(false);
      })
      .catch((err) => {
        console.error("[carrito] resolver fallo:", err);
      })
      .finally(() => {
        if (myAttempt === attemptRef.current) setSettledItems(items);
      });
    return () => {
      // Una respuesta pendiente no debe revivir un carrito vaciado o desmontado.
      attemptRef.current += 1;
    };
  }, [items, isHydrated, remove]);

  const avisosVisibles = useMemo(
    () => (avisosDismissed ? [] : (resuelto?.avisos ?? [])),
    [resuelto, avisosDismissed],
  );

  // No renderizamos nada de negocio hasta que hidrata: el server no sabe
  // que hay en el carrito y renderizaria un estado vacio falso.
  if (!isHydrated) {
    return <SkeletonCarrito />;
  }

  const sinItems = items.length === 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-black text-tinta sm:text-4xl">Tu carrito</h1>

      {avisosVisibles.length > 0 && (
        <div className="mb-6 rounded-xl border-2 border-rosa/20 bg-rosa/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-black text-rosa">Cambios en tu carrito</div>
            <button
              type="button"
              className="text-xs font-bold text-tinta/50 hover:text-tinta"
              onClick={() => setAvisosDismissed(true)}
            >
              Entendido
            </button>
          </div>
          <ul className="space-y-1 text-sm text-tinta/80">
            {avisosVisibles.map((a, i) => (
              <li key={`${a.tipo}-${a.id_item}-${i}`}>
                {a.tipo === "removido" ? (
                  <>
                    Un producto ya no está disponible y lo quitamos del carrito
                    (código {a.id_item}).
                  </>
                ) : (
                  <>
                    El precio de <strong>{a.descripcion}</strong> cambió de{" "}
                    {formatearPrecio(a.anterior)} a{" "}
                    <strong>{formatearPrecio(a.nuevo)}</strong>.
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sinItems ? (
        <EmptyCarrito />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {resuelto?.lineas.map((l) => (
              <div
                key={l.id_item}
                className="flex gap-4 rounded-xl border border-tinta/8 bg-white p-3"
              >
                <Link
                  href={`/producto/${l.slug}`}
                  className="relative aspect-square h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gris"
                >
                  <Image
                    src={l.foto_url ?? placeholderFamilia(l.familia_slug as FamiliaSlug)}
                    alt={l.descripcion}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="text-[10px] font-black uppercase tracking-widest text-rosa">
                    {l.familia}
                  </div>
                  <Link
                    href={`/producto/${l.slug}`}
                    className="line-clamp-2 text-sm font-extrabold text-tinta hover:text-rosa"
                  >
                    {l.descripcion}
                  </Link>
                  <div className="text-xs text-tinta/50">
                    Código: {l.id_item} · {formatearPrecio(l.precio_unitario)} c/u
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3">
                    <QtyControl
                      value={l.cantidad}
                      onChange={(n) => setQty(l.id_item, n)}
                    />
                    <div className="text-right">
                      <div className="text-base font-black text-verde">
                        {formatearPrecio(l.subtotal)}
                      </div>
                      <button
                        type="button"
                        className="text-[11px] font-bold text-tinta/50 hover:text-rosa"
                        onClick={() => remove(l.id_item)}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="pt-2">
              <button
                type="button"
                className="text-xs font-bold text-tinta/50 hover:text-rosa"
                onClick={() => {
                  if (confirm("¿Vaciar el carrito completo?")) clear();
                }}
              >
                Vaciar carrito
              </button>
            </div>
          </div>

          <aside className="h-fit rounded-2xl border border-tinta/8 bg-white p-5">
            <div className="mb-3 text-sm font-black uppercase tracking-wide text-tinta">
              Resumen
            </div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-tinta/70">Subtotal</span>
              <span className="font-bold text-tinta">
                {resuelto ? formatearPrecio(resuelto.subtotal) : "—"}
              </span>
            </div>
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-tinta/70">Envío</span>
              <span className="text-xs font-bold text-tinta/50">Se calcula al pagar</span>
            </div>
            <div className="mb-5 border-t border-tinta/10 pt-3 flex justify-between text-lg font-black">
              <span>Total</span>
              <span className="text-verde">
                {resuelto ? formatearPrecio(resuelto.subtotal) : "—"}
              </span>
            </div>
            <Link
              href="/checkout"
              aria-disabled={cargando || sinItems}
              className={`block rounded-xl px-6 py-4 text-center text-base font-black text-white shadow transition ${
                cargando || sinItems
                  ? "cursor-not-allowed bg-tinta/25"
                  : "bg-rosa hover:-translate-y-0.5 hover:bg-morado hover:shadow-md"
              }`}
              onClick={(e) => {
                if (cargando || sinItems) e.preventDefault();
              }}
            >
              Ir al checkout
            </Link>
            <Link
              href="/catalogo"
              className="mt-3 block text-center text-xs font-bold text-tinta/50 hover:text-rosa"
            >
              Seguir comprando
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}

function QtyControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-tinta/15">
      <button
        type="button"
        aria-label="Disminuir cantidad"
        className="w-8 text-tinta hover:bg-gris"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={99}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (Number.isNaN(n)) return;
          onChange(Math.max(1, Math.min(99, n)));
        }}
        className="w-12 border-x border-tinta/10 text-center text-sm font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label="Aumentar cantidad"
        className="w-8 text-tinta hover:bg-gris"
        onClick={() => onChange(Math.min(99, value + 1))}
        disabled={value >= 99}
      >
        +
      </button>
    </div>
  );
}

function EmptyCarrito() {
  return (
    <div className="rounded-2xl border border-tinta/10 bg-white p-10 text-center">
      <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gris" />
      <h2 className="mb-2 text-xl font-black text-tinta">Tu carrito está vacío</h2>
      <p className="mx-auto mb-6 max-w-md text-sm text-tinta/60">
        Explora las 14 familias del catálogo y agrega lo que necesitas para tu fiesta.
      </p>
      <Link
        href="/catalogo"
        className="inline-flex items-center gap-2 rounded-xl bg-rosa px-6 py-3 text-sm font-black text-white shadow hover:-translate-y-0.5 hover:bg-morado"
      >
        Ir al catálogo
      </Link>
    </div>
  );
}

function SkeletonCarrito() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 h-10 w-56 animate-pulse rounded bg-tinta/10" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-tinta/5" />
          ))}
        </div>
        <div className="h-56 animate-pulse rounded-2xl bg-tinta/5" />
      </div>
    </main>
  );
}
