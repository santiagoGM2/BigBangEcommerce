import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { Database } from "../supabase/database.types";
import { computeEpaycoSignature, mapEpaycoStateToOrderState, type EpaycoConfig } from "./epayco";

type Params = Record<string, unknown>;
type OrderRow = Database["public"]["Tables"]["pedido"]["Row"];
export type PaymentOrder = Pick<OrderRow,
  "id" | "numero" | "estado" | "total" | "referencia_pago" | "transaccion_id" | "updated_at"
>;
export type PaymentOrderPatch = Database["public"]["Tables"]["pedido"]["Update"];

export interface PaymentOrderStore {
  findByNumber(number: string): Promise<PaymentOrder | null>;
  // False indica que otra notificacion modifico el pedido desde la lectura.
  compareAndSet(order: PaymentOrder, patch: PaymentOrderPatch): Promise<boolean>;
}

interface WebhookDependencies {
  config: EpaycoConfig;
  store: PaymentOrderStore;
  lookupTransaction: (reference: string) => Promise<Params>;
  now?: () => Date;
  logger?: Pick<Console, "warn" | "error">;
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return typeof value === "number" ? String(value) : "";
}

function object(value: unknown): value is Params {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function testMode(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const normalized = text(value).toLowerCase();
  return normalized === "true" ? true : normalized === "false" ? false : null;
}

function amount(value: unknown): number | null {
  const raw = text(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function reply(status: number, body: Params): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function parseParams(request: Request): Promise<Params | null> {
  try {
    if (request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      const data: unknown = await request.json();
      return object(data) ? data : null;
    }
    const form = await request.formData();
    const params: Params = {};
    for (const [key, value] of form) {
      if (typeof value !== "string" || key in params) return null;
      params[key] = value;
    }
    return params;
  } catch {
    return null;
  }
}

/**
 * La firma oficial NO cubre factura, estado ni modo de pruebas. Esos datos
 * se contrastan con el registro HTTPS del proveedor antes de escribir.
 * La pagina de retorno del navegador nunca confirma el pago.
 * https://docs.epayco.com/docs/checkout-respuesta-y-confirmacion
 */
export async function handleEpaycoWebhook(
  request: Request,
  { config, store, lookupTransaction, now = () => new Date(), logger = console }: WebhookDependencies,
): Promise<Response> {
  const params = await parseParams(request);
  if (!params) return reply(400, { ok: false, error: "Invalid payload" });

  const reference = text(params.x_ref_payco);
  const transactionId = text(params.x_transaction_id);
  const amountString = text(params.x_amount);
  const currency = text(params.x_currency_code);
  const invoice = text(params.x_id_invoice);
  const signature = text(params.x_signature);
  if (!reference || !transactionId || !amountString || !currency || !invoice || !signature) {
    return reply(400, { ok: false, error: "Missing fields" });
  }

  const expectedSignature = computeEpaycoSignature({
    privateKey: config.privateKey, custId: config.custId, refPayco: reference,
    transactionId, amount: amountString, currencyCode: currency,
  });
  if (!/^[a-f0-9]{64}$/i.test(signature) || !timingSafeEqual(
    Buffer.from(expectedSignature, "hex"), Buffer.from(signature, "hex"),
  )) return reply(400, { ok: false, error: "Invalid signature" });

  const incomingAmount = amount(amountString);
  if (incomingAmount === null) return reply(400, { ok: false, error: "Invalid amount" });
  if (currency !== "COP") return reply(400, { ok: false, error: "Currency mismatch" });
  if (testMode(params.x_test_request) !== config.testMode) {
    return reply(400, { ok: false, error: "Payment environment mismatch" });
  }

  let verified: Params;
  try {
    // ref_payco es opaco en el checkout actual. El recibo x_ref_payco es
    // una alternativa para callbacks del checkout anterior.
    verified = await lookupTransaction(text(params.ref_payco) || reference);
  } catch {
    logger.error("[epayco] no se pudo verificar la transaccion con el proveedor");
    return reply(503, { ok: false, error: "Provider verification unavailable" });
  }

  if (text(verified.x_ref_payco) !== reference ||
      text(verified.x_transaction_id) !== transactionId ||
      text(verified.x_cust_id_cliente) !== config.custId ||
      text(verified.x_id_invoice) !== invoice ||
      amount(verified.x_amount) !== incomingAmount ||
      text(verified.x_currency_code) !== currency ||
      testMode(verified.x_test_request) !== config.testMode) {
    logger.warn("[epayco] notificacion no coincide con el registro del proveedor");
    return reply(400, { ok: false, error: "Provider transaction mismatch" });
  }

  // Una notificacion atrasada no revierte el estado actual del proveedor.
  const nextState = mapEpaycoStateToOrderState(text(verified.x_cod_response));
  if (!nextState) {
    logger.warn("[epayco] estado del proveedor desconocido");
    return reply(200, { ok: true, ignored: true });
  }

  try {
    const updatedAt = now().toISOString();
    // La condicion del UPDATE se evalua atomicamente en Postgres. Si hubo
    // carrera, releemos antes de decidir otra transicion.
    for (let attempt = 0; attempt < 3; attempt++) {
      const order = await store.findByNumber(invoice);
      if (!order) return reply(404, { ok: false, error: "Order not found" });
      // Se conserva la tolerancia comercial existente de un peso.
      if (!Number.isFinite(order.total) || Math.abs(incomingAmount - order.total) > 1) {
        return reply(400, { ok: false, error: "Amount mismatch" });
      }

      if (order.estado === "pagado") {
        return reply(200, order.referencia_pago === reference
          ? { ok: true, idempotent: true } : { ok: true, alreadyPaid: true });
      }
      const terminal = order.estado === "rechazado" || order.estado === "fallido";
      if (terminal && order.referencia_pago === reference &&
          (order.estado === nextState || nextState === "pendiente")) {
        return reply(200, { ok: true, idempotent: true });
      }

      const patch: PaymentOrderPatch = {
        pasarela: "epayco", referencia_pago: reference, transaccion_id: transactionId,
        updated_at: updatedAt,
        metodo_pago: text(verified.x_franchise) || text(verified.x_response) || null,
      };
      // Pendiente solo agrega correlacion; no reabre un pedido cerrado.
      if (nextState !== "pendiente") patch.estado = nextState;
      if (nextState === "pagado") patch.pagado_at = updatedAt;

      if (await store.compareAndSet(order, patch)) {
        return reply(200, nextState === "pendiente"
          ? { ok: true, pending: true } : { ok: true, estado: nextState });
      }
    }
    // No confirmamos exito si nunca se pudo persistir la operacion.
    return reply(503, { ok: false, error: "Concurrent update; retry required" });
  } catch {
    logger.error("[epayco] fallo al consultar o actualizar el pedido");
    return reply(500, { ok: false, error: "Order persistence failed" });
  }
}

/** Consulta acotada al host HTTPS oficial, sin seguir redirecciones. */
export async function fetchEpaycoTransaction(
  reference: string,
  fetcher: typeof fetch = fetch,
): Promise<Params> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(reference)) throw new Error("Invalid payment reference");
  const response = await fetcher(`https://secure.epayco.co/validation/v1/reference/${reference}`, {
    headers: { Accept: "application/json" }, cache: "no-store", redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Payment verification unavailable");
  const result: unknown = await response.json();
  if (!object(result) || result.success !== true || !object(result.data)) {
    throw new Error("Invalid payment verification response");
  }
  return result.data;
}
