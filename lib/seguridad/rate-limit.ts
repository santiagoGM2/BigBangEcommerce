import "server-only";

/**
 * Rate limiter sliding-window en memoria del proceso. Sin dependencias.
 *
 * Trade-offs conocidos y aceptados en este proyecto:
 *
 *   - EN VERCEL SERVERLESS cada invocacion cold-start arranca con el mapa
 *     vacio. Un atacante distribuido puede evadir el limite si logra pegar
 *     siempre en instancias frias. Para produccion seria con volumen alto
 *     hay que migrar a Upstash Redis / Vercel KV / Vercel edge middleware.
 *     Para el volumen esperado de Big Bang (checkout manual + webhook
 *     server-to-server de ePayco) esta implementacion cubre el 95% del
 *     abuso realista sin agregar dependencias ni costo.
 *
 *   - El state vive en globalThis, no a nivel de modulo, por la misma razon
 *     que el cache del catalogo: Turbopack en dev puede evaluar el archivo
 *     dos veces y romperia el limite si el state fuera local.
 *
 * Uso:
 *   const rl = ratelimit(ip, { name: "checkout", max: 10, windowMs: 60_000 });
 *   if (!rl.allowed) return { ok: false, error: "Too many requests" };
 */

interface Bucket {
  // Array de timestamps ms de cada intento dentro de la ventana. Se limpia
  // en cada check quitando los que ya caducaron.
  timestamps: number[];
}

interface RateLimitState {
  buckets: Map<string, Bucket>;
}

const g = globalThis as unknown as { __rlState?: RateLimitState };
const state: RateLimitState =
  g.__rlState ?? (g.__rlState = { buckets: new Map() });

// Limpieza periodica para no crecer indefinidamente la memoria. Se dispara
// en cada llamada; si el mapa tiene mas de 5000 buckets sacamos los que
// llevan >5 min sin actividad. Cheap y suficiente.
function limpiarSiEsNecesario() {
  if (state.buckets.size < 5000) return;
  const cutoff = Date.now() - 5 * 60_000;
  for (const [k, b] of state.buckets.entries()) {
    if (b.timestamps.length === 0 || b.timestamps[b.timestamps.length - 1]! < cutoff) {
      state.buckets.delete(k);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Cuantos intentos quedan en la ventana actual. Cuando llega a 0 y hay uno mas, allowed=false. */
  remaining: number;
  /** Timestamp ms cuando el usuario puede volver a intentar (solo si allowed=false). */
  retryAt?: number;
}

export interface RateLimitOptions {
  /** Namespace del limite: "checkout", "webhook-epayco", "resolver-carrito", etc. */
  name: string;
  /** Cuantos intentos permitidos dentro de la ventana. */
  max: number;
  /** Duracion de la ventana en milisegundos. */
  windowMs: number;
}

/**
 * Chequea + registra un intento contra el bucket key/name.
 */
export function ratelimit(key: string, opts: RateLimitOptions): RateLimitResult {
  limpiarSiEsNecesario();

  const bucketKey = `${opts.name}::${key}`;
  const now = Date.now();
  const windowStart = now - opts.windowMs;

  let bucket = state.buckets.get(bucketKey);
  if (!bucket) {
    bucket = { timestamps: [] };
    state.buckets.set(bucketKey, bucket);
  }

  // Quita timestamps fuera de la ventana.
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= opts.max) {
    // Rechazado: no registra el intento (evita que el atacante extienda
    // artificialmente el bloqueo).
    const oldest = bucket.timestamps[0]!;
    return {
      allowed: false,
      remaining: 0,
      retryAt: oldest + opts.windowMs,
    };
  }

  bucket.timestamps.push(now);
  return {
    allowed: true,
    remaining: opts.max - bucket.timestamps.length,
  };
}

/**
 * Extrae la IP del cliente de un Request o Headers. Prefiere los headers
 * que Vercel / Cloudflare / nginx suelen agregar (mas confiables que
 * req.ip cuando hay proxies en el medio). Si no encuentra ninguno, cae a
 * "unknown" para que igual haya un bucket comun (que actua como global
 * flood limiter).
 */
export function extraerIP(headers: Headers): string {
  // Vercel usa x-forwarded-for; el primer valor es la IP real del cliente.
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  // Cloudflare / otros proxies.
  const alt =
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("true-client-ip");
  if (alt) return alt.trim();
  return "unknown";
}
