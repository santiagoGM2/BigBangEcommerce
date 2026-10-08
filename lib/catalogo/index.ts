import "server-only";

import { CATEGORIA_A_FAMILIA, CATEGORIAS_OCULTAS } from "./familias";
import { FAMILIAS_BY_SLUG, type FamiliaSlug } from "./familias-meta";
import { capitalizarDescripcion } from "./formato";
import { fetchProductosDelProxy } from "./proxy";
import { slugify } from "./slug";
import { fetchProductoExtras, type ProductoExtra } from "./supabase";
import type { ProductoEnriquecido, ProductoProxy } from "./types";

// ============================================================================
// Flags de negocio
// ============================================================================
// Ambos empiezan en false. Cambiar aca cuando el cliente decida.

/**
 * ~698 productos con precio_fuente = 'respaldo_mayorista' solo tienen lista
 * mayorista, nunca tuvieron precio al publico. Si el cliente decide que no
 * deben verse, poner en true.
 */
export const OCULTAR_RESPALDO_MAYORISTA = false;

/**
 * 7 categorias marcadas CONFIRMAR en el CSV: LICORES, CERVEZAS, VINO (venta
 * de alcohol en linea, decision del cliente), PAPEL FOAMY, PAPEL METAL,
 * PAPEL ALUMINIO (manualidades vigentes o rubro discontinuado) y LIQUIDOS
 * (posiblemente para globos). Hoy se muestran; poner en true si el cliente
 * decide ocultarlas.
 */
export const OCULTAR_CATEGORIAS_POR_CONFIRMAR = false;

// ============================================================================
// Cache en memoria — por que asi
// ============================================================================
//
// No usamos unstable_cache de Next porque el payload completo pesa ~4.85MB y
// unstable_cache tiene limite de 2MB (falla silenciosamente en caches, y muy
// ruidosamente en el build).
//
// Este cache es POR INSTANCIA de servidor. Si Vercel levanta varias en
// paralelo, cada una hace su propio fetch. Si el droplet del ERP sufre bajo
// trafico real, la solucion NO es forzar el payload completo dentro de
// unstable_cache, sino cachear POR FAMILIA (cada familia pesa mucho menos
// que 2MB).
// ============================================================================

const TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

interface CacheEntry {
  productos: ProductoEnriquecido[];
  categoriasNoMapeadas: Map<string, number>; // categoria -> cuantos productos omitidos
  timestamp: number;
}

interface CacheState {
  entry: CacheEntry | null;
  // Single-flight: cuando el cache esta vacio y llegan N requests, solo una
  // dispara el fetch al proxy y las N-1 restantes esperan la misma promesa.
  inflight: Promise<CacheEntry> | null;
  // Refresco en background disparado por SWR: no se debe iniciar mas de uno
  // a la vez.
  refreshing: boolean;
}

// El state vive en globalThis, no a nivel de modulo. Turbopack en dev (y
// eventualmente HMR o dos grafos de modulos distintos) puede evaluar este
// archivo mas de una vez; cada evaluacion tendria su propio `state` local y
// romperia single-flight, disparando fetches duplicados. Con globalThis el
// state es un singleton real por proceso, igual al patron del cliente de
// Prisma en Next.
const globalWithCache = globalThis as unknown as {
  __catalogoCacheState?: CacheState;
};

const state: CacheState =
  globalWithCache.__catalogoCacheState ??
  (globalWithCache.__catalogoCacheState = {
    entry: null,
    inflight: null,
    refreshing: false,
  });

/**
 * Devuelve el catalogo completo enriquecido. Es la unica funcion que las
 * paginas y componentes deben usar. Debajo hace fetch al proxy + query a
 * Supabase + cruce + filtros, todo cacheado como una sola unidad.
 */
export async function getProductos(): Promise<ProductoEnriquecido[]> {
  const entry = await getCacheEntry();
  return entry.productos;
}

/**
 * Version segmentada: solo los productos de una familia.
 * Ojo que hoy filtra en memoria del arreglo completo cacheado; cuando
 * pasemos a cache por familia, esta funcion sigue teniendo la misma
 * signatura y solo cambia la implementacion.
 */
export async function getProductosDeFamilia(
  familia: FamiliaSlug,
): Promise<ProductoEnriquecido[]> {
  const productos = await getProductos();
  // Ordena la familia completa antes de paginar. El orden estable conserva
  // el orden previo dentro de cada grupo y no modifica el catalogo cacheado.
  return productos
    .filter((p) => p.familia === familia)
    .sort((a, b) => Number(Boolean(b.foto_url)) - Number(Boolean(a.foto_url)));
}

/**
 * Un producto por su id_item, o null si no existe / no es visible.
 */
export async function getProductoPorId(
  idItem: string,
): Promise<ProductoEnriquecido | null> {
  const productos = await getProductos();
  return productos.find((p) => p.id_item === idItem) ?? null;
}

/**
 * Conteo por familia. Usar SIEMPRE esto en la UI en vez de hardcodear
 * numeros: el catalogo cambia solo cuando el ERP cambia.
 */
export async function getConteoPorFamilia(): Promise<Map<FamiliaSlug, number>> {
  const productos = await getProductos();
  const conteo = new Map<FamiliaSlug, number>();
  for (const p of productos) {
    conteo.set(p.familia, (conteo.get(p.familia) ?? 0) + 1);
  }
  return conteo;
}

// ============================================================================
// Precalentado (llamado desde instrumentation.ts)
// ============================================================================

/**
 * Fuerza el fetch inicial para que la primera visita de una instancia fria
 * no se coma los ~20s del proxy. En instrumentation.ts, en prod se hace con
 * await; en dev sin await para no bloquear next dev.
 */
export async function precalentarCatalogo(): Promise<void> {
  await getCacheEntry();
}

// ============================================================================
// Implementacion del cache: single-flight + stale-while-revalidate
// ============================================================================

async function getCacheEntry(): Promise<CacheEntry> {
  const now = Date.now();

  // Cache lleno y fresco: servimos directo.
  if (state.entry && now - state.entry.timestamp < TTL_MS) {
    return state.entry;
  }

  // Cache lleno pero expirado: SWR. Servimos lo viejo AL INSTANTE y disparamos
  // el refresco en background sin await.
  if (state.entry) {
    if (!state.refreshing) {
      state.refreshing = true;
      // Fire-and-forget. El catch evita que promesas rechazadas tumben nada.
      void construirCacheEntry()
        .then((fresh) => {
          state.entry = fresh;
        })
        .catch((err) => {
          console.error("[catalogo] refresco SWR fallo:", err);
        })
        .finally(() => {
          state.refreshing = false;
        });
    }
    return state.entry;
  }

  // Cache vacio: single-flight. Si otra request ya esta esperando, se une.
  if (state.inflight) return state.inflight;

  state.inflight = construirCacheEntry()
    .then((fresh) => {
      state.entry = fresh;
      return fresh;
    })
    .finally(() => {
      state.inflight = null;
    });

  return state.inflight;
}

async function construirCacheEntry(): Promise<CacheEntry> {
  const inicio = Date.now();

  const [crudos, extras] = await Promise.all([
    fetchProductosDelProxy(),
    fetchProductoExtras(),
  ]);

  const productos: ProductoEnriquecido[] = [];
  const categoriasNoMapeadas = new Map<string, number>();

  for (const raw of crudos) {
    const enriquecido = enriquecer(raw, extras, categoriasNoMapeadas);
    if (enriquecido) productos.push(enriquecido);
  }

  // Advertencia unica y agregada: cuando el ERP crea categorias nuevas que no
  // estan en familias.ts, esos productos se omiten. El warning es la senal de
  // que hay que agregar la categoria al mapa.
  if (categoriasNoMapeadas.size > 0) {
    const detalle = [...categoriasNoMapeadas.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, n]) => `${cat} (${n})`)
      .join(", ");
    console.warn(
      `[catalogo] ${categoriasNoMapeadas.size} categoria(s) del ERP no estan en ` +
        `familias.ts y sus productos se omitieron: ${detalle}. ` +
        `Actualiza _data/categorias-erp.csv y corre pnpm gen:familias.`,
    );
  }

  console.log(
    `[catalogo] cache reconstruido: ${crudos.length} crudos -> ${productos.length} publicables en ${Date.now() - inicio}ms`,
  );

  return {
    productos,
    categoriasNoMapeadas,
    timestamp: Date.now(),
  };
}

function enriquecer(
  raw: ProductoProxy,
  extras: Map<string, ProductoExtra>,
  categoriasNoMapeadas: Map<string, number>,
): ProductoEnriquecido | null {
  // Filtro 1: categoria marcada OCULTAR en el CSV (no negociable).
  if (CATEGORIAS_OCULTAS.has(raw.categoria)) return null;

  // Filtro 2: categoria no mapeada en familias.ts (categoria nueva del ERP).
  const mapa = CATEGORIA_A_FAMILIA.get(raw.categoria);
  if (!mapa) {
    categoriasNoMapeadas.set(
      raw.categoria,
      (categoriasNoMapeadas.get(raw.categoria) ?? 0) + 1,
    );
    return null;
  }

  // Filtro 3: flag de respaldo mayorista.
  if (OCULTAR_RESPALDO_MAYORISTA && raw.precio_fuente === "respaldo_mayorista") {
    return null;
  }

  // Filtro 4: flag de categorias por confirmar.
  if (OCULTAR_CATEGORIAS_POR_CONFIRMAR && mapa.requiereConfirmacion) {
    return null;
  }

  // Filtro 5: producto marcado invisible manualmente en Supabase.
  const extra = extras.get(raw.id_item);
  if (extra && extra.visible === false) return null;

  // Sanity check contra la familia declarada.
  if (!FAMILIAS_BY_SLUG[mapa.familia]) {
    // Esto solo pasaria si alguien edita familias.ts a mano rompiendo el tipo.
    console.warn(
      `[catalogo] familia desconocida "${mapa.familia}" en categoria "${raw.categoria}"`,
    );
    return null;
  }

  return {
    ...raw,
    familia: mapa.familia,
    foto_url: extra?.images[0]?.url ?? extra?.foto_url ?? null,
    images: extra?.images ?? [],
    slug: slugify(raw.descripcion, raw.id_item),
    descripcion_mostrable: capitalizarDescripcion(raw.descripcion),
    requiere_confirmacion: mapa.requiereConfirmacion ?? false,
  };
}
