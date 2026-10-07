import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ORDER_ACCESS_TTL_SECONDS = 7 * 24 * 60 * 60;
const ORDER_NUMBER = /^BB-\d{4}-\d{5,12}$/;
const CONTEXT = "bigbang:order-access:v1";

export function orderAccessCookieName(orderNumber: string): string {
  if (!ORDER_NUMBER.test(orderNumber)) throw new Error("Número de pedido inválido.");
  return `bb-order-${orderNumber}`;
}

export function getOrderAccessSecret(): string {
  // Separación de dominio: la cookie nunca contiene la clave administrativa.
  const secret = process.env.ORDER_ACCESS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || secret.length < 32) throw new Error("Falta una clave segura para el acceso al pedido.");
  return secret;
}

function sign(value: string, secret: string): string {
  if (secret.length < 32) throw new Error("La clave de acceso debe tener al menos 32 caracteres.");
  return createHmac("sha256", secret).update(`${CONTEXT}\0${value}`).digest("base64url");
}

export function createOrderAccessToken(orderNumber: string, secret: string, now = Date.now()): string {
  orderAccessCookieName(orderNumber);
  const expires = Math.floor(now / 1000) + ORDER_ACCESS_TTL_SECONDS;
  const payload = `${orderNumber}.${expires}`;
  return `${expires}.${sign(payload, secret)}`;
}

export function verifyOrderAccessToken(
  orderNumber: string, token: string | undefined, secret: string, now = Date.now(),
): boolean {
  if (!ORDER_NUMBER.test(orderNumber) || !token || token.length > 128) return false;
  const match = /^(\d{10,12})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return false;
  const expires = Number(match[1]);
  const seconds = Math.floor(now / 1000);
  if (!Number.isSafeInteger(expires) || expires <= seconds || expires > seconds + ORDER_ACCESS_TTL_SECONDS) return false;
  const expected = Buffer.from(sign(`${orderNumber}.${expires}`, secret));
  const actual = Buffer.from(match[2]!);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** No ejecuta siquiera la consulta privilegiada cuando falta autorización. */
export async function loadAuthorizedOrder<T>(
  orderNumber: string, token: string | undefined, secret: string, load: () => Promise<T>, now = Date.now(),
): Promise<T | null> {
  return verifyOrderAccessToken(orderNumber, token, secret, now) ? load() : null;
}
