"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CartItem } from "./types";

const STORAGE_KEY = "bb_cart_v1";

/**
 * Limite defensivo para la cantidad por linea. Cualquier valor manual mas
 * alto se recorta. No es una politica de negocio, solo protege contra
 * un usuario que edite el input a 999999.
 */
const MAX_QTY = 99;

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

function readStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is CartItem =>
          typeof x === "object" &&
          x !== null &&
          "id_item" in x &&
          typeof (x as CartItem).id_item === "string" &&
          typeof (x as CartItem).cantidad === "number" &&
          (x as CartItem).cantidad > 0,
      )
      .map((x) => ({
        id_item: x.id_item,
        cantidad: Math.min(MAX_QTY, Math.max(1, Math.floor(x.cantidad))),
      }));
  } catch {
    return [];
  }
}

function writeStorage(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Espacio agotado o modo privado -> no hay nada util que hacer.
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  // Evita escribir en localStorage antes de haber leido: si el usuario abre
  // una segunda pestana justo cuando la primera arranca, no queremos que la
  // segunda pise con [] lo que la primera acababa de escribir.
  const canPersist = useRef(false);

  // Hidratacion inicial.
  useEffect(() => {
    setItems(readStorage());
    setIsHydrated(true);
    canPersist.current = true;
  }, []);

  // Persistencia en cada cambio (post hidratacion).
  useEffect(() => {
    if (!canPersist.current) return;
    writeStorage(items);
  }, [items]);

  // Sincronizacion entre pestanas.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      setItems(readStorage());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((id_item: string, cantidad: number = 1) => {
    setItems((prev) => {
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
    setItems((prev) => {
      if (cantidad <= 0) return prev.filter((x) => x.id_item !== id_item);
      const clamped = Math.min(MAX_QTY, Math.floor(cantidad));
      return prev.map((x) => (x.id_item === id_item ? { ...x, cantidad: clamped } : x));
    });
  }, []);

  const remove = useCallback((id_item: string) => {
    setItems((prev) => prev.filter((x) => x.id_item !== id_item));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
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
