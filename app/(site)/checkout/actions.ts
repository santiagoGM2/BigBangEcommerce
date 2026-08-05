"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolverCarrito } from "@/lib/carrito/resolver";
import type { CartItem } from "@/lib/carrito/types";
import { extraerIP, ratelimit } from "@/lib/seguridad/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// TODO(cliente): definir tabla real de costos de envio (por ciudad? por
// peso? gratis desde X monto?). Hasta que el cliente confirme la tarifa,
// arrancamos en 0 — es preferible cobrar 0 y coordinar el envio por
// WhatsApp que inventar una tarifa. Cuando llegue el numero real, es un
// cambio de una linea (aca y en CheckoutCliente.tsx).
const COSTO_ENVIO_FLAT = 0;

export interface DatosCheckout {
  comprador_nombre: string;
  comprador_telefono: string;
  comprador_email: string;
  comprador_documento?: string;
  envio_direccion: string;
  envio_ciudad: string;
  envio_departamento?: string;
  envio_notas?: string;
}

export interface ResultadoCrearPedido {
  ok: true;
  numero: string;
  redirectTo: string;
}
export interface ErrorCrearPedido {
  ok: false;
  error: string;
  /** Cuando el carrito cambio (removidos o precio), se refleja aca. */
  detalles?: string[];
}

// ---------------------------------------------------------------------------

/**
 * Crea el pedido en Supabase en estado "pendiente" y redirige a la pagina de
 * confirmacion. NO cobra: el paso de pago vive en /checkout/confirmacion
 * (bloqueado por las llaves de ePayco).
 *
 * INVARIANTES CRITICAS (CLAUDE.md):
 *   - Los totales se recalculan aqui desde el catalogo real, NUNCA se
 *     confia en lo que llega del navegador.
 *   - El numero de pedido se genera con la funcion SQL
 *     generate_numero_pedido() (atomica, en zona America/Bogota).
 *   - Escritura con service role: RLS de pedido/pedido_item no tiene
 *     policies publicas.
 */
export async function accionCrearPedido(
  itemsRaw: unknown,
  datosRaw: unknown,
): Promise<ResultadoCrearPedido | ErrorCrearPedido> {
  // Rate limit por IP: 5 pedidos por minuto. Un flujo normal de compra
  // dispara este action UNA vez tras llenar el formulario; 5/min deja
  // amplio margen para reintentos legitimos (usuario que apreta doble
  // el boton, error transitorio de red que reintenta) y bloquea abuso
  // (script creando pedidos falsos).
  const ip = extraerIP(await headers());
  const rl = ratelimit(ip, { name: "crear-pedido", max: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    console.warn("[pedido] rate limit alcanzado", { ip, retryAt: rl.retryAt });
    return {
      ok: false,
      error: "Demasiados intentos seguidos. Espera un momento e inténtalo de nuevo.",
    };
  }

  const items = validarItems(itemsRaw);
  if (items.length === 0) {
    return { ok: false, error: "Tu carrito está vacío." };
  }

  const parsed = validarDatos(datosRaw);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const datos = parsed.datos;

  // Recalcular totales contra el catalogo real. Si el catalogo removio
  // productos o cambio precios, avisamos y NO creamos el pedido: el usuario
  // debe volver al carrito y confirmar el nuevo total.
  const resuelto = await resolverCarrito(items);
  if (resuelto.avisos.length > 0) {
    return {
      ok: false,
      error:
        "El carrito cambió mientras estabas en el checkout. Revísalo y vuelve a intentar.",
      detalles: resuelto.avisos.map((a) =>
        a.tipo === "removido"
          ? `Producto ${a.id_item} ya no está disponible.`
          : `El precio de "${a.descripcion}" cambió de $${a.anterior} a $${a.nuevo}.`,
      ),
    };
  }
  if (resuelto.lineas.length === 0) {
    return { ok: false, error: "Tu carrito quedó vacío al validar." };
  }

  const subtotal = resuelto.subtotal;
  const costoEnvio = COSTO_ENVIO_FLAT;
  const total = subtotal + costoEnvio;

  const admin = getSupabaseAdmin();

  // Numero de pedido con la funcion atomica del backend.
  const { data: numeroData, error: numeroError } = await admin.rpc(
    "generate_numero_pedido",
  );
  if (numeroError || !numeroData) {
    console.error("[pedido] generate_numero_pedido fallo:", numeroError);
    return {
      ok: false,
      error: "No pudimos generar el número de pedido. Intenta de nuevo.",
    };
  }
  const numero = numeroData;

  // Crear la cabecera del pedido.
  const { data: pedido, error: pedidoError } = await admin
    .from("pedido")
    .insert({
      numero,
      estado: "pendiente",
      comprador_nombre: datos.comprador_nombre,
      comprador_telefono: datos.comprador_telefono,
      comprador_email: datos.comprador_email,
      comprador_documento: datos.comprador_documento ?? null,
      envio_direccion: datos.envio_direccion,
      envio_ciudad: datos.envio_ciudad,
      envio_departamento: datos.envio_departamento ?? null,
      envio_notas: datos.envio_notas ?? null,
      subtotal,
      costo_envio: costoEnvio,
      total,
      // pasarela, metodo_pago, referencia_pago, transaccion_id y pagado_at
      // se llenan cuando llegue el webhook de ePayco. Ver
      // /checkout/confirmacion para el punto exacto.
    })
    .select("id")
    .single();
  if (pedidoError || !pedido) {
    console.error("[pedido] insert cabecera fallo:", pedidoError);
    return {
      ok: false,
      error: "No pudimos guardar tu pedido. Intenta de nuevo en unos segundos.",
    };
  }

  // Insertar las lineas.
  const lineasInsert = resuelto.lineas.map((l) => ({
    pedido_id: pedido.id,
    id_item: l.id_item,
    descripcion: l.descripcion,
    cantidad: l.cantidad,
    precio_unitario: l.precio_unitario,
    subtotal: l.subtotal,
  }));

  const { error: lineasError } = await admin.from("pedido_item").insert(lineasInsert);
  if (lineasError) {
    console.error("[pedido] insert lineas fallo:", lineasError);
    // El pedido cabecera quedo huerfano. Como somos idempotentes y la
    // pagina de confirmacion re-consulta por numero, un intento posterior
    // con el MISMO numero fallaria por unique. Es mejor limpiar aca.
    await admin.from("pedido").delete().eq("id", pedido.id);
    return {
      ok: false,
      error: "No pudimos guardar las líneas del pedido. Intenta de nuevo.",
    };
  }

  // Redirect fuera del try — Next lo maneja como throw controlado.
  redirect(`/checkout/confirmacion?pedido=${encodeURIComponent(numero)}`);
}

// ---------------------------------------------------------------------------
// Validacion defensiva
// ---------------------------------------------------------------------------

function validarItems(x: unknown): CartItem[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter(
      (it): it is CartItem =>
        typeof it === "object" &&
        it !== null &&
        typeof (it as CartItem).id_item === "string" &&
        typeof (it as CartItem).cantidad === "number" &&
        (it as CartItem).cantidad > 0,
    )
    .slice(0, 200)
    .map((it) => ({
      id_item: it.id_item.slice(0, 32),
      cantidad: Math.min(99, Math.max(1, Math.floor(it.cantidad))),
    }));
}

type Validado =
  | { ok: true; datos: DatosCheckout }
  | { ok: false; error: string };

// Validacion server-side minima. La misma cara se muestra al usuario en el
// formulario, pero aca no confiamos en lo que dijo el navegador.
function validarDatos(x: unknown): Validado {
  if (typeof x !== "object" || x === null) {
    return { ok: false, error: "Datos de comprador inválidos." };
  }
  const raw = x as Record<string, unknown>;
  const get = (k: string): string => (typeof raw[k] === "string" ? (raw[k] as string).trim() : "");

  const nombre = get("comprador_nombre");
  if (nombre.length < 3 || nombre.length > 120) {
    return { ok: false, error: "El nombre es obligatorio (3-120 caracteres)." };
  }

  const telefono = get("comprador_telefono").replace(/[\s()-]/g, "");
  if (!/^(\+?57)?\d{10}$/.test(telefono)) {
    return {
      ok: false,
      error: "El teléfono debe ser colombiano (10 dígitos, con o sin +57).",
    };
  }

  const email = get("comprador_email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) {
    return { ok: false, error: "El correo electrónico no es válido." };
  }

  const documento = get("comprador_documento");
  if (documento && !/^\d{6,15}$/.test(documento)) {
    return { ok: false, error: "El documento debe ser numérico (6-15 dígitos)." };
  }

  const direccion = get("envio_direccion");
  if (direccion.length < 5 || direccion.length > 200) {
    return { ok: false, error: "La dirección de envío es obligatoria." };
  }

  const ciudad = get("envio_ciudad");
  if (ciudad.length < 2 || ciudad.length > 80) {
    return { ok: false, error: "La ciudad es obligatoria." };
  }

  const departamento = get("envio_departamento");
  if (departamento && departamento.length > 80) {
    return { ok: false, error: "Departamento demasiado largo." };
  }

  const notas = get("envio_notas");
  if (notas.length > 500) {
    return { ok: false, error: "Las notas de envío son demasiado largas." };
  }

  return {
    ok: true,
    datos: {
      comprador_nombre: nombre,
      comprador_telefono: telefono,
      comprador_email: email.toLowerCase(),
      comprador_documento: documento || undefined,
      envio_direccion: direccion,
      envio_ciudad: ciudad,
      envio_departamento: departamento || undefined,
      envio_notas: notas || undefined,
    },
  };
}
