"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { CartItem } from "./types";
import { CART_STORAGE_KEY, MAX_CART_QTY, createCartStorage } from "./storage";

/**
 * Limite defensivo para la cantidad por linea. Cualquier valor manual mas
 * alto se recorta. No es una politica de negocio, solo protege contra
 * un usuario que edite el input a 999999.
 */
const MAX_QTY = MAX_CART_QTY;

interface CartContextValue {
  items: CartItem[];
  /** Suma de cantidades. Utilizado por el badge del navbar. */
  count: number;
  /** false hasta que se hidrata desde localStorage (evita mismatch SSR). */
  isHydrated: boolean;
  add(id_item: string, cantidad?: number): void;
  setQty(id_item: string, cantidad: number): void;
  remove(id_item: string): void;
  clear(): void;
}

const CartContext = createContext<CartContextValue | null>(null);

const cartStorage = createCartStorage({
  read: () => window.localStorage.getItem(CART_STORAGE_KEY),
  write: (value) => window.localStorage.setItem(CART_STORAGE_KEY, value),
  subscribe(listener) {
    function onStorage(event: StorageEvent) {
      if (
        (event.key === CART_STORAGE_KEY || event.key === null) &&
        event.storageArea === window.localStorage
      ) listener();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  },
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { items, isHydrated } = useSyncExternalStore(
    cartStorage.subscribe,
    cartStorage.getSnapshot,
    cartStorage.getServerSnapshot,
  );

  const add = useCallback((id_item: string, cantidad: number = 1) => {
    cartStorage.update((prev) => {
      const existente = prev.find((x) => x.id_item === id_item);
      if (existente) {
        return prev.map((x) =>
          x.id_item === id_item
            ? { ...x, cantidad: Math.min(MAX_QTY, x.cantidad + cantidad) }
            : x,
        );
      }
      return [...prev, { id_item, cantidad: Math.min(MAX_QTY, Math.max(1, cantidad)) }];
    });
  }, []);

  const setQty = useCallback((id_item: string, cantidad: number) => {
    cartStorage.update((prev) => {
      if (cantidad <= 0) return prev.filter((x) => x.id_item !== id_item);
      const clamped = Math.min(MAX_QTY, Math.floor(cantidad));
      return prev.map((x) => (x.id_item === id_item ? { ...x, cantidad: clamped } : x));
    });
  }, []);

  const remove = useCallback((id_item: string) => {
    cartStorage.update((prev) => prev.filter((x) => x.id_item !== id_item));
  }, []);

  const clear = useCallback(() => {
    cartStorage.update(() => []);
  }, []);

  const count = useMemo(
    () => items.reduce((acc, x) => acc + x.cantidad, 0),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({ items, count, isHydrated, add, setQty, remove, clear }),
    [items, count, isHydrated, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart() debe usarse dentro de <CartProvider>");
  }
  return ctx;
}
