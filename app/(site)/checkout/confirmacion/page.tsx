import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { EpaycoCheckoutButton } from "@/components/carrito/EpaycoCheckoutButton";
import { LimpiarCarritoAlMontar } from "@/components/carrito/LimpiarCarritoAlMontar";
import { formatearPrecio } from "@/lib/catalogo/formato";
import { getEpaycoWidgetConfig } from "@/lib/pagos/epayco";
import { SITE } from "@/lib/seo/site";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getOrderAccessSecret, loadAuthorizedOrder, orderAccessCookieName } from "@/lib/seguridad/order-access";

export const metadata: Metadata = {
  title: "Pedido creado",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ pedido?: string }>;
}

// No cachear: la pagina debe reflejar el estado ACTUAL del pedido (puede
// haber cambiado por el webhook mientras el usuario recargaba).
export const dynamic = "force-dynamic";

export default async function ConfirmacionPage({ searchParams }: PageProps) {
  const { pedido: numero } = await searchParams;
  if (!numero || !/^BB-\d{4}-\d{5,12}$/.test(numero)) notFound();
  const token = (await cookies()).get(orderAccessCookieName(numero))?.value;
  if (!token) notFound();
  // Autorizar antes de usar service role: adivinar el número no permite
  // distinguir pedidos existentes ni consultar su información personal.
  const result = await loadAuthorizedOrder(numero, token, getOrderAccessSecret(), async () => getSupabaseAdmin()
    .from("pedido")
    .select(
      "id,numero,estado,subtotal,costo_envio,total,created_at,pagado_at,pasarela,metodo_pago,referencia_pago,comprador_nombre,comprador_email,comprador_telefono,comprador_documento,envio_ciudad,envio_departamento,envio_direccion",
    )
    .eq("numero", numero)
    .maybeSingle());
  if (!result) notFound();
  const { data: ped, error: pedErr } = result;
  if (pedErr) {
    console.error("[confirmacion] consulta pedido fallo:", pedErr);
    throw new Error("No pudimos consultar el pedido.");
  }
  if (!ped) notFound();

  const { data: items, error: itemsError } = await getSupabaseAdmin()
    .from("pedido_item")
    .select("id_item,descripcion,cantidad,precio_unitario,subtotal")
    .eq("pedido_id", ped.id);
  if (itemsError) throw new Error("No pudimos consultar el detalle del pedido.");

  // La UI decide que mostrar en el bloque de pago segun estado del pedido.
  const estado = ped.estado;
  const yaCerrado = estado === "pagado" || estado === "rechazado" || estado === "fallido";
  const epaycoCfg = getEpaycoWidgetConfig();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {/* Vaciar el carrito solo si el pedido esta en estado terminal o
          esperando pago; si esta "fallido" tambien lo vaciamos porque el
          usuario tendria que hacer un nuevo checkout de todas formas. */}
      <LimpiarCarritoAlMontar />

      {/* ---------- Encabezado con estado del pedido ---------- */}
      <HeaderEstado estado={estado} numero={ped.numero} email={ped.comprador_email} />

      {/* ---------- Bloque de pago ----------
          Ramas posibles:
            (A) estado=pendiente + config ePayco completa -> widget
            (B) estado=pendiente + faltan llaves          -> fallback WhatsApp
            (C) estado=pagado                             -> resumen del pago
            (D) estado=rechazado|fallido                  -> aviso + reintentar
                                                            o coordinar WhatsApp
      */}
      {estado === "pendiente" && epaycoCfg && (
        <BloqueWidgetPago
          publicKey={epaycoCfg.publicKey}
          testMode={epaycoCfg.testMode}
          ped={ped}
        />
      )}
      {estado === "pendiente" && !epaycoCfg && (
        <BloqueFallbackWhatsapp numero={ped.numero} total={ped.total} />
      )}
      {estado === "pagado" && <BloquePagoConfirmado ped={ped} />}
      {(estado === "rechazado" || estado === "fallido") && (
        <BloquePagoFallido numero={ped.numero} total={ped.total} estado={estado} />
      )}

      {/* ---------- Detalle del pedido (siempre visible) ---------- */}
      <section className="rounded-2xl border border-tinta/8 bg-white p-6">
        <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-tinta">
          Detalle del pedido
        </h2>

        <div className="mb-5 text-sm">
          <div className="mb-1 font-bold text-tinta">{ped.comprador_nombre}</div>
          <div className="text-tinta/60">
            {ped.envio_direccion}
            <br />
            {ped.envio_ciudad}
            {ped.envio_departamento ? `, ${ped.envio_departamento}` : ""}
          </div>
        </div>

        <ul className="mb-4 divide-y divide-tinta/8 text-sm">
          {items?.map((it) => (
            <li key={it.id_item} className="flex justify-between gap-3 py-2">
              <span className="text-tinta/80">
                {it.cantidad}× {it.descripcion}
              </span>
              <span className="whitespace-nowrap font-bold text-tinta">
                {formatearPrecio(it.subtotal)}
              </span>
            </li>
          ))}
        </ul>

        <div className="space-y-1 border-t border-tinta/10 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-tinta/70">Subtotal</span>
            <span className="font-bold">{formatearPrecio(ped.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tinta/70">Envío</span>
            <span className="font-bold">{formatearPrecio(ped.costo_envio)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-tinta/10 pt-2 text-lg font-black">
            <span>Total</span>
            <span className="text-verde">{formatearPrecio(ped.total)}</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-tinta/50">
            Estado:{" "}
            <span className="font-black uppercase text-tinta">{estado}</span>
          </span>
          <Link href="/catalogo" className="font-bold text-rosa hover:underline">
            Volver al catálogo
          </Link>
        </div>
        {yaCerrado && ped.referencia_pago && (
          <div className="mt-2 text-[11px] text-tinta/40">
            Referencia ePayco: {ped.referencia_pago}
          </div>
        )}
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes visuales
// ---------------------------------------------------------------------------

function HeaderEstado({
  estado,
  numero,
  email,
}: {
  estado: string;
  numero: string;
  email: string;
}) {
  const config: Record<string, { color: string; borderCls: string; icon: React.ReactNode; titulo: string; sub: React.ReactNode }> = {
    pendiente: {
      color: "verde",
      borderCls: "border-verde/30 bg-verde/5",
      icon: (
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
      titulo: "¡Pedido registrado!",
      sub: (
        <>
          Tu número de pedido es <strong className="text-tinta">{numero}</strong>. Completa el
          pago abajo. Te enviaremos la confirmación a{" "}
          <strong className="text-tinta">{email}</strong>.
        </>
      ),
    },
    pagado: {
      color: "verde",
      borderCls: "border-verde/40 bg-verde/10",
      icon: (
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
      titulo: "¡Pago confirmado!",
      sub: (
        <>
          Pedido <strong className="text-tinta">{numero}</strong> pagado y en proceso. Te
          enviamos la confirmación a <strong className="text-tinta">{email}</strong>.
        </>
      ),
    },
    rechazado: {
      color: "morado",
      borderCls: "border-red-200 bg-red-50",
      icon: (
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ),
      titulo: "Pago rechazado",
      sub: (
        <>
          El pago del pedido <strong className="text-tinta">{numero}</strong> fue rechazado por la
          entidad. Puedes reintentar o escribirnos por WhatsApp.
        </>
      ),
    },
    fallido: {
      color: "morado",
      borderCls: "border-red-200 bg-red-50",
      icon: (
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ),
      titulo: "El pago no se completó",
      sub: (
        <>
          El pago del pedido <strong className="text-tinta">{numero}</strong> no se completó.
          Reintenta o escríbenos por WhatsApp.
        </>
      ),
    },
  };
  const c = config[estado] ?? config.pendiente!;
  const iconBg = c.color === "verde" ? "bg-verde" : "bg-red-500";

  return (
    <div className={`mb-8 rounded-2xl border-2 p-8 text-center ${c.borderCls}`}>
      <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-white ${iconBg}`}>
        {c.icon}
      </div>
      <h1 className="mb-1 text-2xl font-black text-tinta sm:text-3xl">{c.titulo}</h1>
      <p className="text-tinta/70">{c.sub}</p>
    </div>
  );
}

function BloqueWidgetPago({
  publicKey,
  testMode,
  ped,
}: {
  publicKey: string;
  testMode: boolean;
  ped: {
    numero: string;
    total: number;
    comprador_nombre: string;
    comprador_email: string;
    comprador_telefono: string;
    comprador_documento: string | null;
    envio_direccion: string;
    envio_ciudad: string;
    envio_departamento: string | null;
  };
}) {
  return (
    <div className="mb-8 rounded-2xl border border-tinta/8 bg-white p-6">
      <div className="mb-3 text-xs font-black uppercase tracking-widest text-rosa">
        Paso final: pago seguro
      </div>
      <p className="mb-4 text-sm text-tinta/70">
        Vas a pagar <strong>{formatearPrecio(ped.total)}</strong> por el pedido{" "}
        <strong>{ped.numero}</strong>. El cobro se hace con ePayco, protegido por SSL.
      </p>
      <EpaycoCheckoutButton
        publicKey={publicKey}
        testMode={testMode}
        numero={ped.numero}
        total={ped.total}
        compradorNombre={ped.comprador_nombre}
        compradorEmail={ped.comprador_email}
        compradorTelefono={ped.comprador_telefono}
        compradorDocumento={ped.comprador_documento}
        envioDireccion={ped.envio_direccion}
        envioCiudad={ped.envio_ciudad}
        envioDepartamento={ped.envio_departamento}
      />
      <p className="mt-3 text-center text-[11px] text-tinta/40">
        Tarjetas débito/crédito · PSE · Efectivo (Baloto, Efecty, Su Red)
      </p>
    </div>
  );
}

function BloqueFallbackWhatsapp({ numero, total }: { numero: string; total: number }) {
  const url = `${SITE.whatsapp}&text=${encodeURIComponent(
    `Hola, quiero pagar mi pedido ${numero} por un total de ${formatearPrecio(total)}.`,
  )}`;
  return (
    <div className="mb-8 rounded-xl border-2 border-dashed border-tinta/20 bg-white p-5 text-sm">
      <div className="mb-2 text-xs font-black uppercase tracking-widest text-rosa">
        Paso final: pago
      </div>
      <p className="text-tinta/70">
        Estamos activando la pasarela de pago en línea. Mientras tanto, escríbenos por
        WhatsApp con tu número <strong>{numero}</strong> y coordinamos el pago y despacho.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener"
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-whatsapp px-5 py-3 text-sm font-black text-white shadow hover:-translate-y-0.5"
      >
        Coordinar pago por WhatsApp
      </a>
    </div>
  );
}

function BloquePagoConfirmado({
  ped,
}: {
  ped: {
    total: number;
    pagado_at: string | null;
    pasarela: string | null;
    metodo_pago: string | null;
  };
}) {
  return (
    <div className="mb-8 rounded-2xl border border-verde/30 bg-white p-6">
      <div className="mb-3 text-xs font-black uppercase tracking-widest text-verde">
        Pago recibido
      </div>
      <ul className="space-y-1 text-sm text-tinta/80">
        <li>
          <strong className="text-tinta">Monto:</strong> {formatearPrecio(ped.total)}
        </li>
        {ped.pagado_at && (
          <li>
            <strong className="text-tinta">Fecha:</strong>{" "}
            {new Date(ped.pagado_at).toLocaleString("es-CO", {
              dateStyle: "long",
              timeStyle: "short",
              timeZone: "America/Bogota",
            })}
          </li>
        )}
        {ped.pasarela && (
          <li>
            <strong className="text-tinta">Pasarela:</strong> {ped.pasarela}
            {ped.metodo_pago ? ` · ${ped.metodo_pago}` : ""}
          </li>
        )}
      </ul>
    </div>
  );
}

function BloquePagoFallido({
  numero,
  total,
  estado,
}: {
  numero: string;
  total: number;
  estado: string;
}) {
  const wa = `${SITE.whatsapp}&text=${encodeURIComponent(
    `Hola, mi pago del pedido ${numero} por ${formatearPrecio(total)} salió como ${estado}. Necesito ayuda.`,
  )}`;
  return (
    <div className="mb-8 rounded-2xl border-2 border-red-200 bg-white p-6">
      <div className="mb-3 text-xs font-black uppercase tracking-widest text-red-600">
        ¿Qué puedes hacer?
      </div>
      <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-tinta/80">
        <li>Verifica los datos de tu tarjeta e intenta de nuevo desde /catalogo.</li>
        <li>Prueba con otro método (PSE, efectivo Baloto/Efecty).</li>
        <li>O escríbenos por WhatsApp y te ayudamos a completar el pago.</li>
      </ul>
      <a
        href={wa}
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-2 rounded-xl bg-whatsapp px-5 py-3 text-sm font-black text-white shadow hover:-translate-y-0.5"
      >
        Escribir por WhatsApp
      </a>
    </div>
  );
}
