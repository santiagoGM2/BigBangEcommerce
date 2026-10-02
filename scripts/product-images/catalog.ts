import "server-only";
import { catalogIds } from "./core";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

// La existencia de un producto no depende de listas de precios ni impuestos.
// Este endpoint consulta la misma vista real del ERP desde el droplet autorizado.
export async function fetchPhotoCatalogIds(fetcher: typeof fetch = fetch): Promise<Set<string>> {
  const base = process.env.CATALOGO_API_BASE;
  const key = process.env.CATALOGO_API_KEY;
  if (!base || !key) throw new Error("Falta configurar el acceso al catalogo.");
  const url = new URL("producto-ids", `${base.replace(/\/$/, "")}/`);
  if (url.protocol !== "https:") throw new Error("El endpoint de IDs requiere HTTPS.");
  const options = { headers: { "x-api-key": key, accept: "application/json" },
    signal: AbortSignal.timeout(75_000), cache: "no-store" as const };
  const connectIp = process.env.CATALOGO_CONNECT_IP;
  if (connectIp && !isIP(connectIp)) throw new Error("IP de diagnostico invalida.");
  // Solo para propagacion DNS: cambia la resolucion, mantiene hostname, SNI
  // y validacion completa del certificado HTTPS. No se configura en Actions.
  const dispatcher = connectIp ? new Agent({ connect: { lookup: (_host, _options, callback) => {
    callback(null, [{ address: connectIp, family: isIP(connectIp) }]);
  } } }) : undefined;
  try {
    const response = dispatcher && fetcher === fetch ? await undiciFetch(url, { ...options, dispatcher }) : await fetcher(url, options);
    if (!response.ok) throw new Error(`Catalogo de IDs: HTTP ${response.status}`);
    const payload = await response.json() as { ids?: unknown; count?: unknown; complete?: unknown; queried_at?: unknown };
    if (payload.complete !== true || !Array.isArray(payload.ids) || payload.count !== payload.ids.length ||
      typeof payload.queried_at !== "string" || !Number.isFinite(Date.parse(payload.queried_at)) ||
      Math.abs(Date.now() - Date.parse(payload.queried_at)) > 5 * 60_000) {
      throw new Error("Respuesta incompleta o desactualizada: se cancela la publicacion.");
    }
    const ids = catalogIds(payload.ids.map(id => ({ id_item: id as string })));
    if (ids.size !== payload.ids.length) throw new Error("Respuesta con IDs duplicados.");
    return ids;
  } finally { await dispatcher?.close(); }
}
