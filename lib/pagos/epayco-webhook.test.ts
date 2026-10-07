import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { computeEpaycoSignature, type EpaycoConfig } from "./epayco";
import { createEpaycoOrderStore } from "./epayco-order-store";
import {
  fetchEpaycoTransaction, handleEpaycoWebhook,
  type PaymentOrder, type PaymentOrderPatch, type PaymentOrderStore,
} from "./epayco-webhook";

const config: EpaycoConfig = {
  publicKey: "synthetic-public-key", privateKey: "synthetic-epayco-key-for-tests-only",
  custId: "test-customer", testMode: false,
};
const initialOrder: PaymentOrder = {
  id: "order-id", numero: "BB-2026-00001", estado: "pendiente", total: 1000,
  referencia_pago: null, transaccion_id: null, updated_at: "2026-01-01T00:00:00Z",
};
const logger = { warn() {}, error() {} };

function notification(overrides: Record<string, string> = {}) {
  const payload = {
    ref_payco: "opaque-reference", x_ref_payco: "123456", x_transaction_id: "tx-1",
    x_id_invoice: initialOrder.numero, x_amount: "1000.00", x_currency_code: "COP",
    x_test_request: "FALSE", x_cod_response: "1", x_cust_id_cliente: config.custId,
    x_franchise: "PSE", ...overrides,
  };
  return {
    ...payload,
    x_signature: computeEpaycoSignature({
      privateKey: config.privateKey, custId: config.custId,
      refPayco: payload.x_ref_payco, transactionId: payload.x_transaction_id,
      amount: payload.x_amount, currencyCode: payload.x_currency_code,
    }),
  };
}

function request(payload: unknown, form = false) {
  return new Request("https://example.test/api/pagos/webhook/epayco", {
    method: "POST", headers: { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" },
    body: form ? new URLSearchParams(payload as Record<string, string>) : JSON.stringify(payload),
  });
}

function memoryStore(seed = initialOrder) {
  let row: PaymentOrder & PaymentOrderPatch = { ...seed };
  const writes: PaymentOrderPatch[] = [];
  const store: PaymentOrderStore = {
    async findByNumber(number) { return number === row.numero ? { ...row } : null; },
    async compareAndSet(snapshot, patch) {
      if (snapshot.updated_at !== row.updated_at) return false;
      writes.push(patch);
      row = { ...row, ...patch, updated_at: `revision-${writes.length}` };
      return true;
    },
  };
  return { store, writes, get row() { return row; } };
}

async function dispatch(
  payload = notification(),
  options: {
    memory?: ReturnType<typeof memoryStore>;
    provider?: Record<string, unknown>;
    store?: PaymentOrderStore;
    lookupTransaction?: (reference: string) => Promise<Record<string, unknown>>;
    test?: boolean;
    form?: boolean;
  } = {},
) {
  const memory = options.memory ?? memoryStore();
  const response = await handleEpaycoWebhook(request(payload, options.form), {
    config: { ...config, testMode: options.test ?? false }, store: options.store ?? memory.store,
    lookupTransaction: options.lookupTransaction ?? (async () => options.provider ?? payload),
    now: () => new Date("2026-10-07T12:00:00Z"), logger,
  });
  return { response, body: await response.json(), memory };
}

describe("ePayco webhook security and persistence", () => {
  it("processes a signed verified payment and makes a retry idempotent", async () => {
    const memory = memoryStore();
    const first = await dispatch(notification(), { memory });
    const retry = await dispatch(notification(), { memory });
    assert.equal(first.response.status, 200);
    assert.equal(retry.body.idempotent, true);
    assert.equal(memory.writes.length, 1);
    assert.equal(memory.row.estado, "pagado");
    assert.equal(memory.row.pagado_at, "2026-10-07T12:00:00.000Z");
    assert.equal(memory.writes[0]?.updated_at, memory.writes[0]?.pagado_at);
  });

  it("accepts the documented form payload and explicit sandbox mode", async () => {
    const result = await dispatch(notification({ x_test_request: "TRUE" }), { test: true, form: true });
    assert.equal(result.response.status, 200);
    assert.equal(result.memory.row.estado, "pagado");
  });

  const invalidNotifications: Record<string, Record<string, string>> = {
    currency: { x_currency_code: "USD" },
    sandbox: { x_test_request: "TRUE" },
    missingMode: { x_test_request: "" },
    malformedAmount: { x_amount: "1000junk" },
    malformedSignature: { x_signature: "bad" },
  };
  for (const [name, override] of Object.entries(invalidNotifications)) {
    it(`rejects ${name} before lookup or writes`, async () => {
      const payload = notification(override);
      if (name === "malformedSignature") payload.x_signature = "bad";
      const result = await dispatch(payload, {
        lookupTransaction: async () => { assert.fail("Provider must not be queried"); },
      });
      assert.equal(result.response.status, 400);
      assert.equal(result.memory.writes.length, 0);
    });
  }

  it("rejects an array payload", async () => {
    const memory = memoryStore();
    const response = await handleEpaycoWebhook(request([]), {
      config, store: memory.store, lookupTransaction: async () => notification(), logger,
    });
    assert.equal(response.status, 400);
    assert.equal(memory.writes.length, 0);
  });

  it("cannot reuse a signature to pay another invoice with the same amount", async () => {
    const provider = notification();
    const incoming = { ...provider, x_id_invoice: "BB-2026-00002" };
    const result = await dispatch(incoming, { provider });
    assert.equal(result.response.status, 400);
    assert.equal(result.memory.writes.length, 0);
  });

  it("uses provider status when the unsigned incoming status is forged", async () => {
    const result = await dispatch(notification(), { provider: notification({ x_cod_response: "2" }) });
    assert.equal(result.response.status, 200);
    assert.equal(result.memory.row.estado, "rechazado");
  });

  it("cannot turn a sandbox transaction into a production payment by editing its mode", async () => {
    const result = await dispatch(notification(), { provider: notification({ x_test_request: "TRUE" }) });
    assert.equal(result.response.status, 400);
    assert.equal(result.memory.writes.length, 0);
  });

  for (const field of ["x_ref_payco", "x_transaction_id", "x_cust_id_cliente", "x_amount", "x_currency_code"]) {
    it(`rejects provider disagreement for ${field}`, async () => {
      const result = await dispatch(notification(), { provider: { ...notification(), [field]: "different" } });
      assert.equal(result.response.status, 400);
      assert.equal(result.memory.writes.length, 0);
    });
  }

  it("prefers opaque ref_payco and returns retryable error if verification is unavailable", async () => {
    const result = await dispatch(notification(), {
      lookupTransaction: async (reference) => {
        assert.equal(reference, "opaque-reference");
        throw new Error("Synthetic provider outage");
      },
    });
    assert.equal(result.response.status, 503);
    assert.equal(result.memory.writes.length, 0);
  });

  it("does not mark a missing order or mismatching total as paid", async () => {
    const missing = await dispatch(notification({ x_id_invoice: "BB-2026-99999" }));
    const mismatch = await dispatch(notification({ x_amount: "9999.00" }));
    assert.equal(missing.response.status, 404);
    assert.equal(mismatch.response.status, 400);
    assert.equal(mismatch.memory.writes.length, 0);
  });

  it("ignores unknown provider states without a write", async () => {
    const result = await dispatch(notification(), { provider: notification({ x_cod_response: "99" }) });
    assert.equal(result.body.ignored, true);
    assert.equal(result.memory.writes.length, 0);
  });

  it("reports pending database write failure instead of acknowledging success", async () => {
    const memory = memoryStore();
    const result = await dispatch(notification({ x_cod_response: "3" }), {
      memory, store: {
        ...memory.store, async compareAndSet() { throw new Error("Synthetic database outage"); },
      },
    });
    assert.equal(result.response.status, 500);
    assert.equal(memory.row.referencia_pago, null);
  });

  it("reports exhausted conflicts as retryable instead of acknowledging a missing write", async () => {
    const memory = memoryStore();
    let attempts = 0;
    const result = await dispatch(notification(), {
      memory, store: { ...memory.store, async compareAndSet() { attempts++; return false; } },
    });
    assert.equal(result.response.status, 503);
    assert.equal(attempts, 3);
    assert.equal(memory.writes.length, 0);
  });

  it("does not overwrite a concurrently paid order with a rejected or pending notification", async () => {
    for (const state of ["2", "3"]) {
      const memory = memoryStore();
      const results = await Promise.all([
        dispatch(notification(), { memory }),
        dispatch(notification({ x_ref_payco: "654321", x_transaction_id: "tx-2", x_cod_response: state }), { memory }),
      ]);
      assert.ok(results.every(({ response }) => response.status === 200));
      assert.equal(memory.row.estado, "pagado");
      assert.equal(memory.row.referencia_pago, "123456");
      assert.equal(memory.writes.length, 1);
    }
  });

  it("rereads conflicts so an approved new attempt can follow a rejected different attempt", async () => {
    const memory = memoryStore();
    await Promise.all([
      dispatch(notification({ x_ref_payco: "654321", x_transaction_id: "tx-2", x_cod_response: "2" }), { memory }),
      dispatch(notification(), { memory }),
    ]);
    assert.equal(memory.row.estado, "pagado");
    assert.equal(memory.row.referencia_pago, "123456");
    assert.equal(memory.writes.length, 2);
  });

  it("keeps a provider-confirmed approval when same-reference notifications race in either order", async () => {
    for (const states of [["1", "2"], ["2", "1"], ["4", "1"], ["1", "4"]]) {
      const memory = memoryStore();
      const results = await Promise.all(states.map((state) => dispatch(
        notification({ x_cod_response: state }), { memory },
      )));
      assert.ok(results.every(({ response }) => response.status === 200));
      assert.equal(memory.row.estado, "pagado");
      assert.equal(memory.row.referencia_pago, "123456");
      assert.equal(memory.row.pagado_at, "2026-10-07T12:00:00.000Z");
    }
  });

  it("does not reopen a rejected order when a late pending notification arrives for that reference", async () => {
    const memory = memoryStore();
    await dispatch(notification({ x_cod_response: "2" }), { memory });
    const pending = await dispatch(notification({ x_cod_response: "3" }), { memory });
    assert.equal(pending.body.idempotent, true);
    assert.equal(memory.row.estado, "rechazado");
    assert.equal(memory.writes.length, 1);
  });
});

describe("ePayco provider request", () => {
  it("queries only the fixed HTTPS origin, without cache or redirects", async () => {
    const result = await fetchEpaycoTransaction("opaque-reference", async (url, init) => {
      assert.equal(url, "https://secure.epayco.co/validation/v1/reference/opaque-reference");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      assert.ok(init?.signal);
      return Response.json({ success: true, data: notification() });
    });
    assert.equal(result.x_ref_payco, "123456");
  });

  it("rejects invalid references before making a network request", async () => {
    await assert.rejects(fetchEpaycoTransaction("../other", async () => {
      assert.fail("No network request allowed");
    }));
  });

  it("rejects provider HTTP and payload failures", async () => {
    for (const response of [
      Response.json({}, { status: 503 }), Response.json({ success: false }),
      Response.json({ success: true, data: [] }),
    ]) await assert.rejects(fetchEpaycoTransaction("123456", async () => response));
  });
});

describe("Supabase atomic payment update", () => {
  it("puts all previous values in one conditional UPDATE and detects a lost race", async () => {
    const client = createClient<Database>("https://example.supabase.co", "synthetic-test-key", {
      auth: { persistSession: false },
      global: { fetch: async (input, init) => {
        assert.equal(init?.method, "PATCH");
        const url = new URL(String(input));
        for (const [field, value] of Object.entries({
          id: "eq.order-id", estado: "eq.pendiente", total: "eq.1000",
          updated_at: "eq.2026-01-01T00:00:00Z", referencia_pago: "is.null", transaccion_id: "is.null",
        })) assert.equal(url.searchParams.get(field), value);
        assert.deepEqual(JSON.parse(String(init?.body)), { estado: "pagado" });
        return Response.json([]);
      } },
    });
    assert.equal(await createEpaycoOrderStore(client).compareAndSet(initialOrder, { estado: "pagado" }), false);
  });

  it("propagates PostgREST errors, including pending writes", async () => {
    const client = createClient<Database>("https://example.supabase.co", "synthetic-test-key", {
      auth: { persistSession: false },
      global: { fetch: async () => Response.json({ message: "Synthetic failure" }, { status: 400 }) },
    });
    await assert.rejects(createEpaycoOrderStore(client).compareAndSet(initialOrder, { referencia_pago: "123456" }));
  });
});
