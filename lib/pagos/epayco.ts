import "server-only";

import { createHash } from "node:crypto";

/**
 * Configuracion de la pasarela ePayco leida desde variables de entorno.
 * Fuente unica: cualquier codigo que necesite hablar con ePayco (widget
 * server-rendered, webhook) pasa por aca.
 *
 * Cuando las tres llaves (`EPAYCO_PUBLIC_KEY`, `EPAYCO_PRIVATE_KEY`,
 * `EPAYCO_P_CUST_ID`) esten seteadas, `getEpaycoConfig()` devuelve la
 * config completa. Si falta cualquiera, devuelve null: la UI muestra el
 * fallback (WhatsApp) y el webhook responde 503.
 *
 * `EPAYCO_TEST_MODE` es booleano: "true" -> sandbox, otra cosa -> prod.
 * Por defecto se asume test para evitar sorpresas si nadie lo definio.
 */

export interface EpaycoConfig {
  publicKey: string;
  privateKey: string;
  custId: string;
  testMode: boolean;
}

export function getEpaycoConfig(): EpaycoConfig | null {
  const publicKey = (process.env.EPAYCO_PUBLIC_KEY ?? "").trim();
  const privateKey = (process.env.EPAYCO_PRIVATE_KEY ?? "").trim();
  const custId = (process.env.EPAYCO_P_CUST_ID ?? "").trim();
  if (!publicKey || !privateKey || !custId) return null;
  const testMode = (process.env.EPAYCO_TEST_MODE ?? "true").toLowerCase() !== "false";
  return { publicKey, privateKey, custId, testMode };
}

/**
 * Datos que la UI envia al widget de ePayco. Solo lleva la porcion NO
 * secreta (la publicKey se puede exponer al navegador; la privateKey NO,
 * esa se queda en el server para verificar la firma del webhook).
 */
export interface EpaycoWidgetConfig {
  publicKey: string;
  testMode: boolean;
}

export function getEpaycoWidgetConfig(): EpaycoWidgetConfig | null {
  const c = getEpaycoConfig();
  if (!c) return null;
  return { publicKey: c.publicKey, testMode: c.testMode };
}

/**
 * Firma que ePayco envia en el webhook.
 *
 *   signature = sha256(
 *     p_cust_id_cliente ^ p_key ^ x_ref_payco ^ x_transaction_id
 *       ^ x_amount ^ x_currency_code
 *   )
 *
 * Donde `^` es literalmente el caracter "^". `p_key` es la privateKey.
 * Fuente: docs.epayco.com/docs/checkout-respuesta-y-confirmacion, que
 * incluye el ejemplo Node oficial usando createHash('sha256').
 *
 * Retorna la firma esperada en hex minusculas.
 *
 * Ver lib/pagos/epayco.test.ts: hay un vector fijo (input y hash escritos
 * como literales, calculados fuera de esta funcion) que romperia si algun
 * dia alguien cambia sha256 por otro algoritmo o toca el orden/separador.
 */
export function computeEpaycoSignature(params: {
  privateKey: string;
  custId: string;
  refPayco: string;
  transactionId: string;
  amount: string; // como string, respetando el formato que envio ePayco
  currencyCode: string;
}): string {
  const raw = [
    params.custId,
    params.privateKey,
    params.refPayco,
    params.transactionId,
    params.amount,
    params.currencyCode,
  ].join("^");
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/**
 * Mapeo de x_transaction_state de ePayco a nuestros estados internos.
 * Estados de la pasarela:
 *   1 Aceptada  2 Rechazada  3 Pendiente  4 Fallida  6 Reversada
 *   7 Retenida  8 Iniciada  10 Abandonada  11 Cancelada  12 Antifraude
 */
export function mapEpaycoStateToOrderState(x_cod_response: string | number):
  | "pagado"
  | "rechazado"
  | "fallido"
  | "pendiente"
  | null {
  const code = typeof x_cod_response === "string" ? parseInt(x_cod_response, 10) : x_cod_response;
  switch (code) {
    case 1:
      return "pagado";
    case 2:
    case 11:
    case 12:
      return "rechazado";
    case 3:
    case 7:
    case 8:
      return "pendiente";
    case 4:
    case 6:
    case 10:
      return "fallido";
    default:
      // Codigo desconocido -> no tocamos el pedido, mejor loguear y salir.
      return null;
  }
}
