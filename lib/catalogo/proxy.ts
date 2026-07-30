import { Agent, fetch as undiciFetch } from "undici";
import type { ProductoProxy } from "./types";

/**
 * Cliente del proxy del catalogo. Se ejecuta SIEMPRE en el servidor: la API
 * key va sin prefijo NEXT_PUBLIC_ y no debe llegar al navegador.
 *
 * El proxy vive en un droplet minimo (1 vCPU compartido, 512MB) y devuelve
 * unos 15.900 productos por llamada (~4.85MB). El fetch completo en frio
 * tarda unos 20-30s (nginx hace renegociaciones SSL y sirve lento por CPU).
 *
 * OJO con los timeouts en Node/undici — son TRES distintos:
 *   - connect.timeout (default 10s): connect + TLS handshake.
 *   - headersTimeout (default 300s): esperar los headers de respuesta.
 *   - bodyTimeout (default 300s): esperar el cuerpo completo.
 *   - AbortSignal.timeout: watchdog global de la operacion completa.
 *
 * Con nginx renegociando, el connect timeout por default es insuficiente y
 * falla con UND_ERR_CONNECT_TIMEOUT antes de que empiece la request. Por eso
 * usamos un Dispatcher explicito con los tres extendidos.
 */

const TIMEOUT_MS = 45_000;
const CONNECT_TIMEOUT_MS = 30_000;

let cachedDispatcher: Agent | null = null;
function getDispatcher(): Agent {
  if (!cachedDispatcher) {
    cachedDispatcher = new Agent({
      connect: { timeout: CONNECT_TIMEOUT_MS },
      headersTimeout: TIMEOUT_MS,
      bodyTimeout: TIMEOUT_MS,
      keepAliveTimeout: 30_000,
    });
  }
  return cachedDispatcher;
}

export async function fetchProductosDelProxy(): Promise<ProductoProxy[]> {
  const base = process.env.CATALOGO_API_BASE;
  const key = process.env.CATALOGO_API_KEY;

  if (!base || !key) {
    throw new Error(
      "CATALOGO_API_BASE o CATALOGO_API_KEY no estan configuradas en el entorno",
    );
  }

  const url = `${base.replace(/\/$/, "")}/productos`;

  // Usamos undici.fetch directamente (no el fetch global de Node) porque el
  // Agent viene del paquete undici de userland: los dispatchers de userland
  // no son compatibles con la undici embebida de Node, y pasar uno al fetch
  // global lanza "invalid onRequestStart method".
  const res = await undiciFetch(url, {
    headers: { "x-api-key": key, accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // Este cache lo maneja getProductos() con su propio SWR: no le agregamos
    // la capa de cache de Next porque unstable_cache tiene limite de 2MB y el
    // payload pesa mas del doble.
    dispatcher: getDispatcher(),
  });

  if (!res.ok) {
    throw new Error(
      `Proxy del catalogo respondio ${res.status} ${res.statusText}`,
    );
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error(
      `Proxy del catalogo devolvio un formato inesperado (no es un arreglo)`,
    );
  }

  return data as ProductoProxy[];
}
