import { test } from "node:test";
import assert from "node:assert/strict";
import { createOrderAccessToken, loadAuthorizedOrder, ORDER_ACCESS_TTL_SECONDS, verifyOrderAccessToken } from "./order-access";

const secret = "synthetic-order-access-fixture-not-a-real-secret";
const now = Date.UTC(2026, 9, 7);
const order = "BB-2026-00001";

test("el comprador puede volver al mismo pedido durante siete días", () => {
  const token = createOrderAccessToken(order, secret, now);
  assert.equal(verifyOrderAccessToken(order, token, secret, now + 60_000), true);
  assert.equal(verifyOrderAccessToken(order, token, secret, now + ORDER_ACCESS_TTL_SECONDS * 1000), false);
});

test("rechaza otro pedido, firma o expiración manipuladas y claves rotadas", () => {
  const token = createOrderAccessToken(order, secret, now);
  const [expires, signature] = token.split(".");
  for (const invalid of [undefined, "", order, `${Number(expires) + 60}.${signature}`, `${expires}.${"a".repeat(43)}`, "x".repeat(200)]) {
    assert.equal(verifyOrderAccessToken(order, invalid, secret, now), false);
  }
  assert.equal(verifyOrderAccessToken("BB-2026-00002", token, secret, now), false);
  assert.equal(verifyOrderAccessToken(order, token, `${secret}-rotated`, now), false);
  assert.equal(verifyOrderAccessToken("../invalid", token, secret, now), false);
});

test("un número adivinado no llega a consultar datos personales", async () => {
  let calls = 0;
  const load = async () => { calls++; return { name: "Cliente de prueba" }; };
  assert.equal(await loadAuthorizedOrder(order, undefined, secret, load, now), null);
  assert.equal(calls, 0);
  const token = createOrderAccessToken(order, secret, now);
  assert.deepEqual(await loadAuthorizedOrder(order, token, secret, load, now), { name: "Cliente de prueba" });
  assert.equal(calls, 1);
});

test("no permite emitir accesos con claves débiles ni números inválidos", () => {
  assert.throws(() => createOrderAccessToken(order, "short", now));
  assert.throws(() => createOrderAccessToken("otro", secret, now));
});
