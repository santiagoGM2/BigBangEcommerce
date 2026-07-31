"use client";

import { useState } from "react";
import { SITE } from "@/lib/seo/site";
import { IconClock, IconPhone, IconPin, IconSearch, IconSend } from "./icons";

const DIRECCION = `${SITE.direccion.calle}, ${SITE.direccion.barrio}, ${SITE.direccion.ciudad}, ${SITE.direccion.departamento}`;

// Coordenadas verificadas desde la ficha real de Google Maps del negocio.
// El formato maps.google.com/maps?q=lat,lng&output=embed no requiere API key
// y muestra el pin rojo por defecto centrado en el punto.
const MAPS_EMBED = "https://maps.google.com/maps?q=3.4294643,-76.5365267&z=17&output=embed";

const MAPS_DIR_URL =
  "https://www.google.com/maps/dir/?api=1&destination=Pi%C3%B1atas+y+Regalos+Big+Bang+Cali";

export function Encuentranos() {
  const [origin, setOrigin] = useState("");

  function openDirections() {
    const q = origin.trim();
    if (!q) return;
    const dest = encodeURIComponent("Piñatas y Regalos Big Bang, Cali, Colombia");
    const orig = encodeURIComponent(`${q}, Cali, Colombia`);
    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${orig}&destination=${dest}`,
      "_blank",
      "noopener",
    );
  }

  return (
    <section className="bb-map-root" id="encuentranos">
      <div className="bb-map-inner">
        <div className="bb-map-header">
          <div className="bb-map-label">Encuéntranos</div>
          <h2 className="bb-map-title">
            Visítanos en <span>Cali</span>
          </h2>
          <p className="bb-map-sub">{DIRECCION}</p>
        </div>

        <div className="bb-map-layout">
          <div className="bb-map-frame">
            <iframe
              src={MAPS_EMBED}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Mapa Big Bang Piñatas"
            />
          </div>

          <div className="bb-map-panel">
            <div className="bb-map-card">
              <div className="bb-map-card-title">
                <IconSearch width={16} height={16} stroke="#E91E8C" />
                ¿Cómo llegar?
              </div>
              <div className="bb-map-input-row">
                <input
                  type="text"
                  className="bb-map-input"
                  placeholder="Escribe tu dirección o barrio…"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") openDirections();
                  }}
                />
                <button
                  type="button"
                  className="bb-map-input-btn"
                  onClick={openDirections}
                >
                  Ir
                </button>
              </div>
            </div>

            <div className="bb-map-card bb-map-card-info">
              <div className="bb-map-info-item">
                <div className="bb-map-info-icon">
                  <IconPin width={16} height={16} stroke="#E91E8C" />
                </div>
                <div className="bb-map-info-text">
                  <strong>Dirección</strong>
                  <span>{DIRECCION}</span>
                </div>
              </div>

              <div className="bb-map-info-item">
                <div className="bb-map-info-icon">
                  <IconClock width={16} height={16} stroke="#E91E8C" />
                </div>
                <div className="bb-map-info-text">
                  <strong>Horario</strong>
                  <span>
                    Lun – Sáb: 8:30 am – 6:30 pm
                    <br />
                    Dom: 9:00 am – 6:30 pm
                  </span>
                </div>
              </div>

              <div className="bb-map-info-item">
                <div className="bb-map-info-icon">
                  <IconPhone width={16} height={16} stroke="#E91E8C" />
                </div>
                <div className="bb-map-info-text">
                  <strong>Teléfono</strong>
                  <span>{SITE.telefono}</span>
                </div>
              </div>
            </div>

            <a
              href={MAPS_DIR_URL}
              target="_blank"
              rel="noopener"
              className="bb-map-directions-btn"
            >
              <IconSend width={15} height={15} />
              Abrir en Google Maps
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
