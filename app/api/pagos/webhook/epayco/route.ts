import "server-only";

import { NextResponse } from "next/server";
import {
  computeEpaycoSignature,
  getEpaycoConfig,
  mapEpaycoStateToOrderState,
} from "@/lib/pagos/epayco";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type PedidoUpdate = Database["public"]["Tables"]["pedido"]["Update"];

/**
 * Webhook server-to-server de ePayco. Es la UNICA via por la que un pedido
 * pasa a estado "pagado". La pagina de retorno del usuario NUNCA lo hace:
 * sus parametros son falsificables.
 *
 * Contrato de ePayco (documentado en el manual de "Confirmacion / URL de
 * confirmacion"):
 *
 *   1) El endpoint DEBE responder 200 rapido. ePayco reintenta hasta 3 veces
 *      con backoff si no obtiene 200.
 *   2) Los parametros llegan como application/x-www-form-urlencoded por POST.
 *      Nosotros ademas aceptamos JSON por si en pruebas o algun modo alterno
 *      llegan asi (defensivo).
 *   3) La firma se calcula sobre 6 campos:
 *        md5(p_cust_id ^ p_key ^ x_ref_payco ^ x_transaction_id ^ x_amount
 *            ^ x_currency_code)
 *   4) El endpoint DEBE ser idempotente. ePayco puede reintentar el mismo
 *      x_ref_payco varias veces (por reintento propio o por reproceso). No
 *      duplicamos: si el pedido ya tiene esta referencia_pago Y ya esta en
 *      estado terminal (pagado/rechazado/fallido), respondemos 200 sin
 *      tocar nada.
 *
 * INVARIANTES CRITICAS (CLAUDE.md > Seguridad):
 *   - Firma valida obligatoria: sin firma valida, NO se actualiza nada.
 *   - Recalculo defensivo: el monto y numero del webhook se validan
 *     contra el pedido en BD; si no coinciden, se rechaza (posible
 *     tampering).
 *   - Idempotencia por x_ref_payco.
 */

// Fuerza runtime dinamico (no cachear) y usa Node runtime (necesitamos
// node:crypto para MD5). En Vercel edge no habria crypto.md5 disponible.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const cfg = getEpaycoConfig();
  if (!cfg) {
    // Sin llaves aun no podemos verificar nada. Respondemos 503 (Service
    // Unavailable). ePayco reintentara; cuando pongan las llaves las
    // notificaciones diferidas se procesaran solas.
    console.warn("[epayco] webhook rechazado: faltan EPAYCO_* env vars");
    return NextResponse.json(
      { ok: false, error: "Payment gateway not configured" },
      { status: 503 },
    );
  }

  // ---- Parseo tolerante: form-urlencoded o JSON --------------------------
  const params = await parseParams(req);
  if (!params) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const refPayco = str(params.x_ref_payco);
  const transactionId = str(params.x_transaction_id);
  const amountStr = str(params.x_amount);
  const currencyCode = str(params.x_currency_code) || "COP";
  const signature = str(params.x_signature);
  const numero = str(params.x_id_invoice);
  const codResponse = str(params.x_cod_response); // 1..12
  const franchise = str(params.x_franchise); // VS, MC, PSE, etc.
  const response = str(params.x_response); // "Aceptada"/"Rechazada"/...

  // Campos obligatorios para poder validar firma + identificar pedido.
  if (!refPayco || !transactionId || !amountStr || !numero || !signature) {
    console.warn("[epayco] webhook con campos faltantes", {
      hasRef: !!refPayco,
      hasTx: !!transactionId,
      hasAmount: !!amountStr,
      hasInvoice: !!numero,
      hasSig: !!signature,
    });
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  // ---- Verificacion de firma --------------------------------------------
  const esperado = computeEpaycoSignature({
    privateKey: cfg.privateKey,
    custId: cfg.custId,
    refPayco,
    transactionId,
    amount: amountStr,
    currencyCode,
  });
  if (!timingSafeEqualHex(esperado, signature)) {
    console.warn("[epayco] firma invalida", { refPayco, numero });
    // 400 para alinear con el ejemplo oficial de ePayco (por si su
    // reintentador espera ese codigo especifico ante firma invalida).
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  // ---- Lookup del pedido -------------------------------------------------
  const admin = getSupabaseAdmin();
  const { data: pedido, error: pedErr } = await admin
    .from("pedido")
    .select("id,numero,estado,total,referencia_pago")
    .eq("numero", numero)
    .maybeSingle();
  if (pedErr) {
    console.error("[epayco] lookup pedido fallo:", pedErr);
    // 500 para que ePayco reintente.
    return NextResponse.json({ ok: false, error: "Lookup failed" }, { status: 500 });
  }
  if (!pedido) {
    // Numero no existe: puede ser un ataque o un pedido de otro entorno.
    // Respondemos 404 para que ePayco no reintente indefinidamente.
    console.warn("[epayco] pedido no encontrado", { numero });
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  // ---- Validacion defensiva del monto ------------------------------------
  // El monto del webhook DEBE coincidir con el pedido en BD (evita que
  // alguien construya un webhook falso con la firma correcta -si tuviera
  // la privateKey- para marcar un pedido de $100.000 como pagado por $1).
  //
  // ePayco puede enviar el monto con decimales ("29900.00"). Comparamos
  // como numero, tolerando <= 1 peso de diferencia por redondeo.
  const amountRecibido = parseFloat(amountStr);
  if (!Number.isFinite(amountRecibido) || Math.abs(amountRecibido - pedido.total) > 1) {
    console.warn("[epayco] monto no coincide", {
      numero,
      esperado: pedido.total,
      recibido: amountStr,
    });
    return NextResponse.json({ ok: false, error: "Amount mismatch" }, { status: 400 });
  }

  // ---- Idempotencia ------------------------------------------------------
  // Si el pedido ya tiene la misma referencia_pago Y ya esta en estado
  // terminal, respondemos 200 sin hacer nada (ePayco reintento).
  const estadoActual = pedido.estado;
  const yaCerrado = estadoActual === "pagado" || estadoActual === "rechazado" || estadoActual === "fallido";
  if (yaCerrado && pedido.referencia_pago === refPayco) {
    return NextResponse.json({ ok: true, idempotent: true }, { status: 200 });
  }

  // Si el pedido ya esta pagado con OTRA referencia distinta -> algo raro
  // (dos pagos exitosos para el mismo pedido?). Loguear y no tocar.
  if (estadoActual === "pagado" && pedido.referencia_pago !== refPayco) {
    console.warn("[epayco] pedido ya pagado con otra referencia", {
      numero,
      guardada: pedido.referencia_pago,
      entrante: refPayco,
    });
    return NextResponse.json({ ok: true, alreadyPaid: true }, { status: 200 });
  }

  // ---- Mapeo estado ------------------------------------------------------
  const nuevoEstado = mapEpaycoStateToOrderState(codResponse);
  if (!nuevoEstado) {
    console.warn("[epayco] codigo de respuesta desconocido", { codResponse, response });
    // 200 para que ePayco no reintente indefinidamente un codigo que no
    // sabemos que hacer con el; queda log para revision manual.
    return NextResponse.json({ ok: true, ignored: true, codResponse }, { status: 200 });
  }

  // Un estado "pendiente" desde el webhook NO es transicion, es info.
  // Guardamos referencia_pago para poder correlacionar despues, pero no
  // cambiamos estado (ya es "pendiente" en BD).
  if (nuevoEstado === "pendiente") {
    await admin
      .from("pedido")
      .update({
        pasarela: "epayco",
        referencia_pago: refPayco,
        transaccion_id: transactionId,
        metodo_pago: franchise || response || null,
      })
      .eq("id", pedido.id);
    return NextResponse.json({ ok: true, pending: true }, { status: 200 });
  }

  // ---- Actualizacion final ----------------------------------------------
  const patch: PedidoUpdate = {
    estado: nuevoEstado,
    pasarela: "epayco",
    referencia_pago: refPayco,
    transaccion_id: transactionId,
    metodo_pago: franchise || response || null,
  };
  if (nuevoEstado === "pagado") {
    patch.pagado_at = new Date().toISOString();
  }

  const { error: updErr } = await admin.from("pedido").update(patch).eq("id", pedido.id);
  if (updErr) {
    console.error("[epayco] update pedido fallo:", updErr);
    return NextResponse.json({ ok: false, error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, estado: nuevoEstado }, { status: 200 });
}

/**
 * GET: ePayco hace un ping ocasional para chequear disponibilidad. Un 200
 * simple basta; tambien util para healthchecks propios.
 */
export function GET() {
  const cfg = getEpaycoConfig();
  return NextResponse.json({
    ok: true,
    configured: cfg !== null,
    testMode: cfg?.testMode ?? null,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Params = Record<string, unknown>;

async function parseParams(req: Request): Promise<Params | null> {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();

  try {
    if (ct.includes("application/json")) {
      const j = await req.json();
      if (typeof j !== "object" || j === null) return null;
      return j as Params;
    }
    // Por defecto (y para form-urlencoded o multipart), leemos como formData.
    const form = await req.formData();
    const out: Params = {};
    for (const [k, v] of form.entries()) {
      out[k] = typeof v === "string" ? v : v.name;
    }
    return out;
  } catch (err) {
    console.warn("[epayco] no se pudo parsear el body:", err);
    return null;
  }
}

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
}

/**
 * Comparacion de strings hex en tiempo constante. Evita side-channel de
 * timing (aunque en la practica esto es un webhook: la ventaja es marginal
 * pero es una linea trivial). Ambas cadenas se normalizan a lower-case.
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  const A = a.toLowerCase();
  const B = b.toLowerCase();
  if (A.length !== B.length) return false;
  let diff = 0;
  for (let i = 0; i < A.length; i++) {
    diff |= A.charCodeAt(i) ^ B.charCodeAt(i);
  }
  return diff === 0;
}
