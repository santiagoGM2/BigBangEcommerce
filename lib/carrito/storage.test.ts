import assert from "node:assert/strict";
import { test } from "node:test";
import { createCartStorage } from "./storage";

function createHarness(initial: string | null = null) {
  let value = initial;
  let writeFails = false;
  let readFails = false;
  let writes = 0;
  const listeners = new Set<() => void>();
  const store = createCartStorage({
    read() {
      if (readFails) throw new Error("Storage bloqueado");
      return value;
    },
    write(next) {
      if (writeFails) throw new Error("Cuota agotada");
      value = next;
      writes += 1;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  });
  return {
    store,
    get writes() { return writes; },
    get subscriptions() { return listeners.size; },
    failWrites() { writeFails = true; },
    failReads() { readFails = true; },
    externalWrite(next: string | null) {
      value = next;
      listeners.forEach((listener) => listener());
    },
  };
}

test("hidrata el carrito existente sin sobrescribirlo y conserva los ceros del ID", () => {
  const harness = createHarness('[{"id_item":"000002","cantidad":3}]');
  const server = harness.store.getServerSnapshot();
  assert.deepEqual(server, { items: [], isHydrated: false });
  const client = harness.store.getSnapshot();
  assert.deepEqual(client, {
    items: [{ id_item: "000002", cantidad: 3 }], isHydrated: true,
  });
  assert.equal(harness.store.getSnapshot(), client);
  assert.equal(harness.store.getServerSnapshot(), server);
  assert.equal(harness.writes, 0);
});

test("sincroniza cambios y vaciado de otra pestana sin ciclos de escritura", () => {
  const harness = createHarness();
  let notifications = 0;
  const unsubscribe = harness.store.subscribe(() => { notifications += 1; });
  harness.store.getSnapshot();
  harness.externalWrite('[{"id_item":"000480","cantidad":2}]');
  assert.equal(harness.store.getSnapshot().items[0]?.id_item, "000480");
  harness.externalWrite(null);
  assert.deepEqual(harness.store.getSnapshot().items, []);
  assert.equal(notifications, 2);
  assert.equal(harness.writes, 0);
  unsubscribe();
  assert.equal(harness.subscriptions, 0);
});

test("cada cambio local notifica a los consumidores y persiste una sola vez", () => {
  const harness = createHarness();
  let notifications = 0;
  const first = harness.store.subscribe(() => { notifications += 1; });
  const second = harness.store.subscribe(() => { notifications += 1; });
  assert.equal(harness.subscriptions, 1);
  harness.store.update(() => [{ id_item: "000480", cantidad: 1 }]);
  harness.store.update((items) => items.map((item) => ({ ...item, cantidad: 2 })));
  assert.equal(harness.store.getSnapshot().items[0]?.cantidad, 2);
  assert.equal(notifications, 4);
  assert.equal(harness.writes, 2);
  first();
  assert.equal(harness.subscriptions, 1);
  second();
  assert.equal(harness.subscriptions, 0);
});

test("si localStorage no permite escribir conserva el carrito en memoria", () => {
  const harness = createHarness('[{"id_item":"000002","cantidad":1}]');
  harness.store.getSnapshot();
  harness.failWrites();
  harness.store.update(() => [{ id_item: "000480", cantidad: 3 }]);
  assert.deepEqual(harness.store.getSnapshot().items, [{ id_item: "000480", cantidad: 3 }]);
  harness.store.update((items) => [...items, { id_item: "000479", cantidad: 1 }]);
  assert.equal(harness.store.getSnapshot().items.length, 2);
  harness.failReads();
  assert.equal(harness.store.getSnapshot().items.length, 2);
});

test("tolera almacenamiento corrupto y normaliza cantidades sin convertir IDs a numeros", () => {
  const harness = createHarness("{invalido");
  assert.deepEqual(harness.store.getSnapshot().items, []);
  harness.externalWrite(JSON.stringify([
    { id_item: "000001", cantidad: 150 },
    { id_item: "000002", cantidad: 2.8 },
    { id_item: 3, cantidad: 1 },
    { id_item: "000004", cantidad: 0 },
    null,
  ]));
  assert.deepEqual(harness.store.getSnapshot().items, [
    { id_item: "000001", cantidad: 99 },
    { id_item: "000002", cantidad: 2 },
  ]);
});
