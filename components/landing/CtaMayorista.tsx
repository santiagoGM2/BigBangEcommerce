import { IconBag, IconDollar, IconTruck, IconUsers, IconWhatsapp } from "./icons";
// IconDollar sigue usandose en el beneficio "Precio mayorista automatico";
// se quito solo del pill "UMBRAL DE COMPRA MAYORISTA" por pedido de UX.

// Modelo real del programa mayorista de Big Bang: es UN UMBRAL FIJO — se
// supera cierta compra y el pedido entra a precio mayorista. No hay escala
// porcentual por monto (era la premisa de la calculadora anterior, incorrecta).
//
// TODO(cliente): confirmar el umbral exacto en pesos. Mientras llega ese
// dato, mostramos "$XXX.XXX" como placeholder marcado, en la misma linea
// de los demas datos pendientes de confirmar (calificacion Google, testimonio
// atribuido, "+500 mayoristas").
const UMBRAL_PLACEHOLDER = "$XXX.XXX";

// Mensaje pre-armado para WhatsApp. Se recorta la firma "?" del final del
// SITE.whatsapp para poder anexar &text=.
const WA_MSG = encodeURIComponent(
  "Hola, quisiera información sobre el programa mayorista de Big Bang y cómo aplicar para comprar a precio mayorista.",
);
const WA_URL = `https://api.whatsapp.com/send?phone=573215581600&text=${WA_MSG}`;

export function CtaMayorista() {
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
            Accede al <span className="bb-pink">precio mayorista</span>
          </h2>
          <p className="bb-mw-sub">
            Superas un umbral fijo de compra y tu pedido entra automáticamente
            a precio mayorista. Sin trámites, sin cuotas mensuales, sin
            escalones raros.
          </p>
        </div>

        <div className="bb-mw-grid">
          {/* Panel principal: umbral + cta */}
          <div className="bb-mw-panel">
            <div className="bb-mw-panel-tag">
              Umbral de compra mayorista
            </div>
            <div className="bb-mw-umbral">
              {/* TODO(cliente): reemplazar UMBRAL_PLACEHOLDER por el monto real
                  del umbral mayorista, en pesos colombianos (ej: "$500.000"). */}
              <span className="bb-mw-umbral-pesos">$</span>
              <span className="bb-mw-umbral-num">
                {UMBRAL_PLACEHOLDER.replace("$", "")}
              </span>
            </div>
            <p className="bb-mw-umbral-desc">
              Es el monto mínimo del pedido para que apliquen precios
              mayoristas en toda la orden. Aplica en tienda y a domicilio.
            </p>

            <div className="bb-mw-cta-box">
              <p className="bb-mw-cta-help">
                Escríbenos por WhatsApp y un asesor te confirma el umbral
                actualizado, te arma la cotización y te acompaña en la primera
                compra.
              </p>
              <a
                className="bb-cta-btn"
                href={WA_URL}
                target="_blank"
                rel="noopener"
              >
                <IconWhatsapp width={20} height={20} />
                Quiero unirme al programa mayorista
              </a>
              <div className="bb-cta-note">
                Respuesta en menos de 2 horas · Lun–Sáb 8:30am–6:30pm
              </div>
            </div>
          </div>

          {/* Beneficios + pasos + prueba social */}
          <div className="bb-right">
            <div className="bb-benefits-card">
              <div className="bb-benefits-title">
                Qué obtienes al superar el umbral
                <span className="bb-benefits-badge">Automático</span>
              </div>
              <div
                className="bb-benefit-item"
                style={
                  {
                    ["--ibg" as string]: "rgba(233,30,140,0.08)",
                    ["--ic" as string]: "#E91E8C",
                  } as React.CSSProperties
                }
              >
                <div className="bb-benefit-ico">
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
