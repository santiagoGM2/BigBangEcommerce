import type { CartItem } from "./types";

export const CART_STORAGE_KEY = "bb_cart_v1";
export const MAX_CART_QTY = 99;

interface CartStorageDriver {
  read(): string | null;
  write(value: string): void;
  subscribe(listener: () => void): () => void;
}

interface CartSnapshot {
  items: CartItem[];
  isHydrated: boolean;
}

const SERVER_SNAPSHOT: CartSnapshot = { items: [], isHydrated: false };

function parseItems(raw: string | null): CartItem[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is CartItem =>
          typeof item === "object" &&
          item !== null &&
          typeof item.id_item === "string" &&
          typeof item.cantidad === "number" &&
          Number.isFinite(item.cantidad) &&
          item.cantidad > 0,
      )
      .map((item) => ({
        id_item: item.id_item,
        cantidad: Math.min(MAX_CART_QTY, Math.max(1, Math.floor(item.cantidad))),
      }));
  } catch {
    return [];
  }
}

/**
 * El estado pertenece a localStorage; React se suscribe sin escribir un []
 * durante la hidratacion. Si el navegador impide persistir, conserva la compra
 * en memoria mientras la pagina permanezca abierta.
 */
export function createCartStorage(driver: CartStorageDriver) {
  let persistedRaw: string | null | undefined;
  let snapshot: CartSnapshot = { items: [], isHydrated: true };
  const listeners = new Set<() => void>();
  let unsubscribe: (() => void) | undefined;

  function notify() {
    listeners.forEach((listener) => listener());
  }

  function getSnapshot() {
    try {
      const raw = driver.read();
      if (raw !== persistedRaw) {
        persistedRaw = raw;
        snapshot = { items: parseItems(raw), isHydrated: true };
      }
    } catch {
      // Modo privado o almacenamiento bloqueado: usar la copia en memoria.
    }
    return snapshot;
  }

  return {
    getSnapshot,
    getServerSnapshot: () => SERVER_SNAPSHOT,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) unsubscribe = driver.subscribe(notify);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          unsubscribe?.();
          unsubscribe = undefined;
        }
      };
    },
    update(updater: (items: CartItem[]) => CartItem[]) {
      const items = updater(getSnapshot().items);
      snapshot = { items, isHydrated: true };
      const raw = JSON.stringify(items);
      try {
        driver.write(raw);
        persistedRaw = raw;
      } catch {
        // No descartar cambios del usuario si la cuota esta agotada.
      }
      notify();
    },
  };
}
