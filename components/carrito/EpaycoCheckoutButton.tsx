"use client";

import Script from "next/script";
import { useCallback, useState } from "react";
import { SITE } from "@/lib/seo/site";

/**
 * Widget de ePayco Checkout (modal on-page). Cargamos el SDK oficial una
 * sola vez via next/script y llamamos `ePayco.checkout.configure(...).open(...)`
 * al hacer clic. El SDK dispara la modal, procesa la tarjeta (o PSE, o
 * efectivo) contra ePayco y al terminar:
 *   - Envia al usuario a la URL `response` (misma pagina de confirmacion).
 *   - Hace POST server-to-server a `confirmation` (nuestro webhook).
 *
 * INVARIANTE: aca NUNCA se toca la privateKey ni se calcula estado. El
 * unico camino que puede marcar un pedido como pagado es el webhook, que
 * valida firma con la privateKey en el servidor.
 */

// Tipado minimo del objeto global inyectado por checkout.js. No hay tipos
// oficiales de @types para ePayco; declaramos lo que usamos y punto.
interface EpaycoHandler {
  open(data: Record<string, unknown>): void;
}
interface EpaycoCheckoutSdk {
  configure(cfg: { key: string; test: boolean }): EpaycoHandler;
}
declare global {
  interface Window {
    ePayco?: { checkout: EpaycoCheckoutSdk };
  }
}

interface Props {
  publicKey: string;
  testMode: boolean;
  numero: string;
  total: number;
  compradorNombre: string;
  compradorEmail: string;
  compradorTelefono: string;
  compradorDocumento?: string | null;
  envioDireccion: string;
  envioCiudad: string;
  envioDepartamento?: string | null;
}

export function EpaycoCheckoutButton({
  publicKey,
  testMode,
  numero,
  total,
  compradorNombre,
  compradorEmail,
  compradorTelefono,
  compradorDocumento,
  envioDireccion,
  envioCiudad,
  envioDepartamento,
}: Props) {
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abrirCheckout = useCallback(() => {
    setError(null);
    if (typeof window === "undefined" || !window.ePayco) {
      setError("La pasarela de pago aún no está lista. Espera un momento e intenta de nuevo.");
      return;
    }
    const handler = window.ePayco.checkout.configure({
      key: publicKey,
      test: testMode,
    });

    const origin = window.location.origin;
    handler.open({
      // Comercio y transaccion
      name: SITE.nombre,
      description: `Pedido ${numero}`,
      invoice: numero, // llega al webhook como x_id_invoice
      currency: "cop",
      amount: total,
      tax_base: "0",
      tax: "0",
      country: "co",
      lang: "es",
      // externo=false abre la modal on-page; true redirige a pagina ePayco.
      // Elegimos modal para no perder el estado del usuario en el sitio.
      external: "false",

      // Datos del comprador
      name_billing: compradorNombre,
      address_billing: envioDireccion,
      type_doc_billing: compradorDocumento ? "cc" : "cc",
      mobilephone_billing: compradorTelefono,
      number_doc_billing: compradorDocumento ?? "",
      email_billing: compradorEmail,

      // URLs
      // response: URL a la que ePayco redirige al usuario tras pagar.
      //   Volvemos a la misma pagina de confirmacion; el usuario ve el
      //   estado actualizado del pedido (si el webhook ya llego) o el
      //   estado "pendiente" (si aun no). Un refresh basta para ver el
      //   estado final.
      response: `${origin}/checkout/confirmacion?pedido=${encodeURIComponent(numero)}`,
      // confirmation: URL server-to-server. Aca ePayco envia el POST con
      //   la firma. Es la UNICA via por la que el pedido pasa a pagado.
      confirmation: `${origin}/api/pagos/webhook/epayco`,

      // Metadatos opcionales que ayudan al soporte de ePayco
      extra1: envioCiudad,
      extra2: envioDepartamento ?? "",
    });
  }, [
    publicKey,
    testMode,
    numero,
    total,
    compradorNombre,
    compradorEmail,
    compradorTelefono,
    compradorDocumento,
    envioDireccion,
    envioCiudad,
    envioDepartamento,
  ]);

  return (
    <>
      <Script
        src="https://checkout.epayco.co/checkout.js"
        strategy="lazyOnload"
        onLoad={() => setScriptReady(true)}
        onError={() =>
          setError("No pudimos cargar la pasarela de pago. Verifica tu conexión e intenta de nuevo.")
        }
      />

      <button
        type="button"
        onClick={abrirCheckout}
        disabled={!scriptReady}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rosa px-6 py-4 text-base font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-morado hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
      >
        {scriptReady ? "Pagar ahora" : "Cargando pasarela..."}
      </button>
      {testMode && (
        <p className="mt-2 text-center text-[11px] font-bold uppercase tracking-widest text-morado">
          Modo pruebas ePayco
        </p>
      )}
      {error && (
        <p className="mt-2 text-center text-xs font-bold text-red-600">{error}</p>
      )}
    </>
  );
}
