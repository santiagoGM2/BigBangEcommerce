"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { accionResolverCarrito } from "@/app/(site)/carrito/actions";
import { accionCrearPedido } from "@/app/(site)/checkout/actions";
import { useCart } from "@/lib/carrito/CartContext";
import { formatearPrecio } from "@/lib/catalogo/formato";
import type { CarritoResuelto } from "@/lib/carrito/types";

const DEPARTAMENTOS = [
  "Valle del Cauca",
  "Antioquia",
  "Cundinamarca",
  "Atlántico",
  "Santander",
  "Bolívar",
  "Nariño",
  "Cauca",
  "Risaralda",
  "Quindío",
  "Tolima",
  "Huila",
  "Meta",
  "Boyacá",
  "Norte de Santander",
  "Otro",
];

// Mismo valor que la server action (fuente de verdad = actions.ts). En 0
// hasta que el cliente confirme la tarifa real; ver TODO en actions.ts.
const COSTO_ENVIO_UI = 0;

interface FormState {
  comprador_nombre: string;
  comprador_telefono: string;
  comprador_email: string;
  comprador_documento: string;
  envio_direccion: string;
  envio_ciudad: string;
  envio_departamento: string;
  envio_notas: string;
}

const INITIAL: FormState = {
  comprador_nombre: "",
  comprador_telefono: "",
  comprador_email: "",
  comprador_documento: "",
  envio_direccion: "",
  envio_ciudad: "Cali",
  envio_departamento: "Valle del Cauca",
  envio_notas: "",
};

export function CheckoutCliente() {
  const router = useRouter();
  const { items, isHydrated } = useCart();
  const [resuelto, setResuelto] = useState<CarritoResuelto | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errores, setErrores] = useState<Partial<Record<keyof FormState, string>>>({});
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<string[]>([]);
  const [enviando, startTransition] = useTransition();
  const attemptRef = useRef(0);

  // Si el carrito esta vacio, sacar del checkout.
  useEffect(() => {
    if (!isHydrated) return;
    if (items.length === 0) router.replace("/carrito");
  }, [isHydrated, items.length, router]);

  useEffect(() => {
    if (!isHydrated || items.length === 0) return;
    const myAttempt = ++attemptRef.current;
    accionResolverCarrito(items)
      .then((r) => {
        if (myAttempt !== attemptRef.current) return;
        setResuelto(r);
      })
      .catch((err) => console.error("[checkout] resolver fallo:", err));
  }, [items, isHydrated]);

  const total = useMemo(() => {
    if (!resuelto) return null;
    return resuelto.subtotal + COSTO_ENVIO_UI;
  }, [resuelto]);

  function upd<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    if (errores[k]) setErrores((prev) => ({ ...prev, [k]: undefined }));
  }

  // Validacion cliente — mismos criterios que la server action, para
  // feedback rapido. Server siempre revalida.
  function validarCliente(): boolean {
    const err: Partial<Record<keyof FormState, string>> = {};
    const nombre = form.comprador_nombre.trim();
    if (nombre.length < 3) err.comprador_nombre = "Ingresa tu nombre completo.";

    const tel = form.comprador_telefono.replace(/[\s()-]/g, "");
    if (!/^(\+?57)?\d{10}$/.test(tel))
      err.comprador_telefono = "Debe tener 10 dígitos (con o sin +57).";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.comprador_email))
      err.comprador_email = "Correo inválido.";

    const doc = form.comprador_documento.trim();
    if (doc && !/^\d{6,15}$/.test(doc))
      err.comprador_documento = "Solo dígitos, 6-15 caracteres.";

    if (form.envio_direccion.trim().length < 5)
      err.envio_direccion = "Ingresa la dirección de envío.";

    if (form.envio_ciudad.trim().length < 2)
      err.envio_ciudad = "Ingresa la ciudad.";

    setErrores(err);
    return Object.keys(err).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorGlobal(null);
    setDetalles([]);
    if (!validarCliente()) return;

    startTransition(async () => {
      const res = await accionCrearPedido(items, form);
      if (res.ok) {
        // accionCrearPedido llama redirect(), asi que en la practica no
        // llegamos aca. Lo dejamos por si se cambia la estrategia.
        router.push(res.redirectTo);
        return;
      }
      setErrorGlobal(res.error);
      setDetalles(res.detalles ?? []);
    });
  }

  if (!isHydrated || items.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="h-40 animate-pulse rounded-xl bg-tinta/5" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <nav className="mb-4 text-sm text-tinta/60" aria-label="Miga de pan">
        <Link href="/carrito" className="hover:text-rosa">
          Carrito
        </Link>
        <span className="mx-2">/</span>
        <span className="text-tinta">Checkout</span>
      </nav>

      <h1 className="mb-6 text-3xl font-black text-tinta sm:text-4xl">
        Datos para tu pedido
      </h1>

      {errorGlobal && (
        <div className="mb-6 rounded-xl border-2 border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-black">{errorGlobal}</div>
          {detalles.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-red-700">
              {detalles.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
          {detalles.length > 0 && (
            <Link
              href="/carrito"
              className="mt-3 inline-block font-bold text-red-900 underline"
            >
              Volver al carrito
            </Link>
          )}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid gap-6 lg:grid-cols-[1fr_320px]"
        noValidate
      >
        <div className="space-y-6">
          <section className="rounded-2xl border border-tinta/8 bg-white p-6">
            <h2 className="mb-4 text-lg font-black text-tinta">Tus datos</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nombre completo"
                required
                error={errores.comprador_nombre}
              >
                <input
                  type="text"
                  autoComplete="name"
                  value={form.comprador_nombre}
                  onChange={(e) => upd("comprador_nombre", e.target.value)}
                  className={inputCls(!!errores.comprador_nombre)}
                />
              </Field>

              <Field
                label="Teléfono"
                required
                error={errores.comprador_telefono}
                hint="10 dígitos, con o sin +57"
              >
                <input
                  type="tel"
                  autoComplete="tel-national"
                  value={form.comprador_telefono}
                  onChange={(e) => upd("comprador_telefono", e.target.value)}
                  className={inputCls(!!errores.comprador_telefono)}
                />
              </Field>

              <Field
                label="Correo electrónico"
                required
                error={errores.comprador_email}
              >
                <input
                  type="email"
                  autoComplete="email"
                  value={form.comprador_email}
                  onChange={(e) => upd("comprador_email", e.target.value)}
                  className={inputCls(!!errores.comprador_email)}
                />
              </Field>

              <Field
                label="Documento (opcional)"
                error={errores.comprador_documento}
                hint="Necesario para factura electrónica"
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.comprador_documento}
                  onChange={(e) => upd("comprador_documento", e.target.value)}
                  className={inputCls(!!errores.comprador_documento)}
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-tinta/8 bg-white p-6">
            <h2 className="mb-4 text-lg font-black text-tinta">Envío</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label="Dirección"
                  required
                  error={errores.envio_direccion}
                  hint="Calle, número, apartamento, barrio"
                >
                  <input
                    type="text"
                    autoComplete="street-address"
                    value={form.envio_direccion}
                    onChange={(e) => upd("envio_direccion", e.target.value)}
                    className={inputCls(!!errores.envio_direccion)}
                  />
                </Field>
              </div>

              <Field
                label="Ciudad"
                required
                error={errores.envio_ciudad}
              >
                <input
                  type="text"
                  autoComplete="address-level2"
                  value={form.envio_ciudad}
                  onChange={(e) => upd("envio_ciudad", e.target.value)}
                  className={inputCls(!!errores.envio_ciudad)}
                />
              </Field>

              <Field label="Departamento">
                <select
                  value={form.envio_departamento}
                  onChange={(e) => upd("envio_departamento", e.target.value)}
                  className={inputCls(false)}
                >
                  {DEPARTAMENTOS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="sm:col-span-2">
                <Field label="Notas (opcional)" hint="Referencias, indicaciones al mensajero, etc.">
                  <textarea
                    value={form.envio_notas}
                    onChange={(e) => upd("envio_notas", e.target.value)}
                    rows={3}
                    className={inputCls(false)}
                  />
                </Field>
              </div>
            </div>
          </section>
        </div>

        <aside className="h-fit space-y-4">
          <div className="rounded-2xl border border-tinta/8 bg-white p-5">
            <div className="mb-3 text-sm font-black uppercase tracking-wide text-tinta">
              Resumen
            </div>
            <ul className="mb-3 space-y-2 text-sm">
              {resuelto?.lineas.map((l) => (
                <li key={l.id_item} className="flex justify-between gap-2">
                  <span className="line-clamp-1 text-tinta/80">
                    {l.cantidad}× {l.descripcion}
                  </span>
                  <span className="whitespace-nowrap font-bold text-tinta">
                    {formatearPrecio(l.subtotal)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t border-tinta/10 pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-tinta/70">Subtotal</span>
                <span className="font-bold">
                  {resuelto ? formatearPrecio(resuelto.subtotal) : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-tinta/70">Envío</span>
                <span className="text-xs font-bold text-tinta/50">
                  Se coordina por WhatsApp
                </span>
              </div>
              <div className="mt-2 flex justify-between border-t border-tinta/10 pt-2 text-lg font-black">
                <span>Total</span>
                <span className="text-verde">
                  {total !== null ? formatearPrecio(total) : "—"}
                </span>
              </div>
            </div>
            {/* TODO(cliente): definir tabla real de costos de envio (por
                ciudad? por peso? gratis desde X monto?). Hasta que llegue,
                el envio va en 0 y se coordina por WhatsApp con el asesor. */}
            <p className="mt-2 text-[10px] text-tinta/40">
              * El costo de envío se confirma con nuestro asesor por WhatsApp.
            </p>
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="block w-full rounded-xl bg-rosa px-6 py-4 text-center text-base font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-morado hover:shadow-md disabled:cursor-not-allowed disabled:bg-tinta/25"
          >
            {enviando ? "Creando pedido..." : "Continuar al pago"}
          </button>
          <p className="text-center text-[11px] text-tinta/50">
            Al continuar aceptas nuestros términos. Tu pedido se registra en
            estado <strong>pendiente</strong> hasta confirmar el pago.
          </p>
        </aside>
      </form>
    </main>
  );
}

function inputCls(hasError: boolean): string {
  return `w-full rounded-lg border-2 px-3 py-2.5 text-sm font-semibold text-tinta outline-none transition ${
    hasError
      ? "border-red-400 focus:border-red-500"
      : "border-tinta/10 focus:border-rosa"
  }`;
}

function Field({
  label,
  children,
  required,
  error,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-wide text-tinta/70">
        {label}
        {required && <span className="text-rosa"> *</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-bold text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-tinta/40">{hint}</span>
      ) : null}
    </label>
  );
}
