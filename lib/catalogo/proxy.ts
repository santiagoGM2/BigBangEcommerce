import { Agent, fetch as undiciFetch } from "undici";
import type { ProductoProxy } from "./types";

/**
 * Cliente del proxy del catalogo. Se ejecuta SIEMPRE en el servidor: la API
 * key va sin prefijo NEXT_PUBLIC_ y no debe llegar al navegador.
 *
 * El proxy fue optimizado: ahora responde desde cache en memoria con gzip
 * activado en pocos milisegundos (antes eran ~17s de TTFB porque hacia
 * SELECT * sobre 45 columnas x 25.924 filas). Con esa latencia real,
 * los timeouts deben ser cortos: timeouts largos esconden problemas.
 *
 * OJO con los timeouts en Node/undici — son cuatro distintos:
 *   - connect.timeout (default 10s): connect + TLS handshake. En la vida
 *     real DNS+connect+TLS del droplet suma ~200ms (medido con curl -w).
 *   - headersTimeout: esperar los headers de respuesta.
 *   - bodyTimeout: esperar el cuerpo completo.
 *   - AbortSignal.timeout: watchdog global de la operacion completa.
 *
 * Todos configurados en el Agent para no depender de defaults distintos por
 * version de undici.
 */

const TIMEOUT_MS = 15_000;
const CONNECT_TIMEOUT_MS = 5_000;

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
