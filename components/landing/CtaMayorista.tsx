"use client";

import { useMemo, useState } from "react";
import { formatearPrecio } from "@/lib/catalogo/formato";
import { IconBag, IconDollar, IconTruck, IconUsers, IconWhatsapp } from "./icons";

// ============================================================================
// Configuracion del programa mayorista
// ============================================================================
// Modelo real del programa: hay UN unico umbral minimo de compra a partir del
// cual el pedido entra a precio mayorista. El descuento es aproximado porque
// varia segun las referencias especificas — no es un porcentaje fijo
// garantizado. Estas dos constantes viven aca en un solo lugar; cuando el
// cliente confirme los valores reales es cambio de una linea.
//
// TODO(cliente): confirmar UMBRAL_MINIMO_MAYORISTA en pesos colombianos.
// TODO(cliente): confirmar DESCUENTO_APROXIMADO_MAYORISTA (fraccion 0-1;
// ej: 0.20 para "20% aprox").
const UMBRAL_MINIMO_MAYORISTA = 500_000;
const DESCUENTO_APROXIMADO_MAYORISTA = 0.2;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/**
 * Extrae el numero de un string que puede venir con puntos, comas, $ o
 * espacios (formato colombiano tipico: "$500.000"). Retorna 0 si no hay
 * digitos. Cap defensivo a 999.999.999 para evitar overflow visual y
 * mensajes con 20 ceros.
 */
function parseMonto(s: string): number {
  const solo = s.replace(/[^\d]/g, "");
  if (!solo) return 0;
  const n = parseInt(solo, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(n, 999_999_999);
}

/** "12345678" -> "12.345.678". Se usa para pintar el input mientras se escribe. */
function formatearInput(n: number): string {
  if (!n) return "";
  return n.toLocaleString("es-CO").replace(/,/g, ".");
}

const PCT_LABEL = `${Math.round(DESCUENTO_APROXIMADO_MAYORISTA * 100)}% aprox`;

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function CtaMayorista() {
  const [texto, setTexto] = useState("");
  const monto = useMemo(() => parseMonto(texto), [texto]);

  const alcanza = monto >= UMBRAL_MINIMO_MAYORISTA;
  const falta = alcanza ? 0 : UMBRAL_MINIMO_MAYORISTA - monto;
  const ahorro = alcanza
    ? Math.round(monto * DESCUENTO_APROXIMADO_MAYORISTA)
    : 0;
  // Progreso hacia el umbral (0..1) para la barra visual cuando aun falta.
  const progreso = Math.min(1, monto / UMBRAL_MINIMO_MAYORISTA);

  // Mensaje de WhatsApp adapatado al estado. Cuando el monto es 0 (el usuario
  // no escribio nada), va un mensaje generico. Cuando escribio algo, el
  // asesor recibe el numero exacto y el estado del calculo.
  const waHref = useMemo(() => {
    let msg: string;
    if (monto === 0) {
      msg = "Hola, quisiera información sobre el programa mayorista de Big Bang y cómo aplicar para comprar a precio mayorista.";
    } else if (!alcanza) {
      msg = `Hola, planeo un pedido de ${formatearPrecio(monto)}. Me faltan ${formatearPrecio(falta)} para llegar al umbral mayorista de ${formatearPrecio(UMBRAL_MINIMO_MAYORISTA)}. ¿Cómo me pueden ayudar a completarlo?`;
    } else {
      msg = `Hola, planeo un pedido de ${formatearPrecio(monto)}. Con el descuento mayorista (~${Math.round(DESCUENTO_APROXIMADO_MAYORISTA * 100)}%) mi ahorro estimado sería de ${formatearPrecio(ahorro)}. Quisiera una cotización con precios reales.`;
    }
    return `https://api.whatsapp.com/send?phone=573215581600&text=${encodeURIComponent(msg)}`;
  }, [monto, alcanza, falta, ahorro]);

  const btnLabel = monto === 0
    ? "Quiero unirme al programa mayorista"
    : alcanza
      ? `Cotizar mi pedido — ahorro ${formatearPrecio(ahorro)}`
      : "Escribir al asesor para completar el pedido";

  return (
    <section className="bb-mw">
      <div className="bb-mw-dots" />
      <div className="bb-mw-inner">
        <div className="bb-mw-header">
          <div className="bb-mw-pill">
            <div className="bb-mw-pill-pulse" />
            Canal mayorista
          </div>
          <h2 className="bb-mw-h1">
            ¿Compras al por mayor?
            <br />
            Calcula tu <span className="bb-pink">ahorro estimado</span>
          </h2>
          <p className="bb-mw-sub">
            Superas el umbral mínimo de compra y tu pedido entra a precio
            mayorista. Escribe cuánto planeas comprar y ve tu ahorro
            aproximado al instante.
          </p>
        </div>

        <div className="bb-mw-grid">
          {/* Panel principal: estimador interactivo + CTA */}
          <div className={`bb-mw-panel ${alcanza ? "is-alcanza" : ""}`}>
            <div className="bb-mw-panel-tag">Estimador mayorista</div>

            <label className="bb-est-label" htmlFor="bb-est-input">
              ¿Cuánto planeas comprar?
            </label>
            <div className="bb-est-input-wrap">
              <span className="bb-est-input-prefix">$</span>
              <input
                id="bb-est-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={formatearInput(monto)}
                onChange={(e) => setTexto(e.target.value)}
                className="bb-est-input"
                aria-describedby="bb-est-result"
              />
            </div>

            <div className="bb-est-result" id="bb-est-result" role="status" aria-live="polite">
              {monto === 0 && (
                <p className="bb-est-hint">
                  Escribe el monto de tu pedido para ver tu ahorro estimado.
                </p>
              )}

              {monto > 0 && !alcanza && (
                <>
                  <div className="bb-est-falta">
                    Te faltan{" "}
                    <strong className="bb-est-falta-num">
                      {formatearPrecio(falta)}
                    </strong>{" "}
                    para acceder a precio mayorista
                  </div>
                  <div
                    className="bb-est-bar"
                    role="progressbar"
                    aria-valuenow={Math.round(progreso * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Progreso hacia el umbral mayorista"
                  >
                    <div
                      className="bb-est-bar-fill"
                      style={{ width: `${Math.max(4, progreso * 100)}%` }}
                    />
                  </div>
                  <div className="bb-est-bar-marks">
                    <span>{formatearPrecio(monto)}</span>
                    <span>
                      Umbral{" "}
                      <strong>{formatearPrecio(UMBRAL_MINIMO_MAYORISTA)}</strong>
                    </span>
                  </div>
                </>
              )}

              {alcanza && (
                <>
                  <div className="bb-est-alcanza-tag">
                    ¡Aplicas a precio mayorista!
                  </div>
                  <div className="bb-est-ahorro">
                    <span className="bb-est-ahorro-label">Ahorro estimado</span>
                    <div className="bb-est-ahorro-num">
                      <span className="bb-est-ahorro-pesos">$</span>
                      {formatearInput(ahorro)}
                    </div>
                    <span className="bb-est-ahorro-sub">
                      {PCT_LABEL} sobre tu pedido de {formatearPrecio(monto)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Disclaimer siempre visible: aplica en todos los estados. */}
            <p className="bb-est-nota">
              Este cálculo es un estimado. El porcentaje exacto depende de
              las referencias de tu pedido — te confirmamos el valor real
              al cotizar.
            </p>

            <div className="bb-mw-cta-box">
              <a
                className="bb-cta-btn"
                href={waHref}
                target="_blank"
                rel="noopener"
              >
                <IconWhatsapp width={20} height={20} />
                {btnLabel}
              </a>
              <div className="bb-cta-note">
                Respuesta en menos de 2 horas · Lun–Sáb 8:30am–6:30pm
              </div>
            </div>
          </div>

          {/* Beneficios + pasos + prueba social — sin cambios */}
          <div className="bb-right">
            <div className="bb-benefits-card">
              <div className="bb-benefits-title">
                Qué obtienes al superar el umbral
                <span className="bb-benefits-badge">Automático</span>
              </div>
              <div className="bb-benefit-item">
                <div
                  className="bb-benefit-ico"
                  style={
                    {
                      ["--ibg" as string]: "rgba(233,30,140,0.08)",
                      ["--ic" as string]: "#E91E8C",
                    } as React.CSSProperties
                  }
                >
                  <IconDollar width={17} height={17} strokeWidth="2.5" />
                </div>
                <div>
                  <div className="bb-benefit-name">Precio mayorista automático</div>
                  <div className="bb-benefit-desc">
                    Sin descuentos manuales ni códigos: tu carrito lo aplica al
                    superar el umbral.
                  </div>
                </div>
              </div>
              <div className="bb-benefit-item">
                <div
                  className="bb-benefit-ico"
                  style={
                    {
                      ["--ibg" as string]: "rgba(125,199,32,0.08)",
                      ["--ic" as string]: "#7DC720",
                    } as React.CSSProperties
                  }
                >
                  <IconTruck width={17} height={17} strokeWidth="2.5" />
                </div>
                <div>
                  <div className="bb-benefit-name">Domicilio prioritario en Cali</div>
                  <div className="bb-benefit-desc">
                    Pedidos mayoristas se despachan primero, en 24 horas hábiles.
                  </div>
                </div>
              </div>
              <div className="bb-benefit-item">
                <div
                  className="bb-benefit-ico"
                  style={
                    {
                      ["--ibg" as string]: "rgba(61,26,110,0.08)",
                      ["--ic" as string]: "#3D1A6E",
                    } as React.CSSProperties
                  }
                >
                  <IconUsers width={17} height={17} strokeWidth="2.5" />
                </div>
                <div>
                  <div className="bb-benefit-name">Asesor por WhatsApp</div>
                  <div className="bb-benefit-desc">
                    Una persona real que te ayuda a armar el pedido, sin bots.
                  </div>
                </div>
              </div>
              <div className="bb-benefit-item">
                <div
                  className="bb-benefit-ico"
                  style={
                    {
                      ["--ibg" as string]: "rgba(233,30,140,0.08)",
                      ["--ic" as string]: "#E91E8C",
                    } as React.CSSProperties
                  }
                >
                  <IconBag width={17} height={17} strokeWidth="2.5" />
                </div>
                <div>
                  <div className="bb-benefit-name">Catálogo exclusivo</div>
                  <div className="bb-benefit-desc">
                    Productos y bundles pensados para revender, no disponibles
                    al público general.
                  </div>
                </div>
              </div>
            </div>

            <div className="bb-steps-card">
              <div className="bb-steps-deco" />
              <div className="bb-steps-title">Así de fácil empieza</div>
              <div className="bb-step-item">
                <div className="bb-step-n">1</div>
                <div>
                  <div className="bb-step-t">Escríbenos por WhatsApp</div>
                  <div className="bb-step-d">
                    Cuéntanos qué tipo de negocio tienes y qué categorías te
                    interesan.
                  </div>
                </div>
              </div>
              <div className="bb-step-item">
                <div className="bb-step-n">2</div>
                <div>
                  <div className="bb-step-t">Recibe la cotización mayorista</div>
                  <div className="bb-step-d">
                    Con umbral confirmado, precios reales y estimación de envío.
                  </div>
                </div>
              </div>
              <div className="bb-step-item">
                <div className="bb-step-n">3</div>
                <div>
                  <div className="bb-step-t">Compra, revende y crece</div>
                  <div className="bb-step-d">
                    Despachamos en 24h. Tú te quedas con el margen.
                  </div>
                </div>
              </div>
            </div>

            <div className="bb-proof-card">
              <div className="bb-proof-avatars">
                <div
                  className="bb-proof-av"
                  style={{ ["--avc" as string]: "#E91E8C" } as React.CSSProperties}
                >
                  AP
                </div>
                <div
                  className="bb-proof-av"
                  style={{ ["--avc" as string]: "#3D1A6E" } as React.CSSProperties}
                >
                  JR
                </div>
                <div
                  className="bb-proof-av"
                  style={{ ["--avc" as string]: "#7DC720" } as React.CSSProperties}
                >
                  MG
                </div>
                <div
                  className="bb-proof-av"
                  style={{ ["--avc" as string]: "#E91E8C" } as React.CSSProperties}
                >
                  LS
                </div>
              </div>
              <div>
                {/* TODO(cliente): confirmar la cifra "+500 mayoristas activos
                    en el Valle". No hay fuente conocida. */}
                <div className="bb-proof-main">
                  Mayoristas activos en todo el Valle
                </div>
                <div className="bb-proof-stars">★★★★★</div>
                {/* TODO(cliente): la cita atribuida a "Adriana P." no viene de
                    Google Reviews. Confirmar autoria real o reemplazar. */}
                <div className="bb-proof-sub">
                  &ldquo;Nunca me han fallado en una entrega&rdquo; — Adriana P.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
