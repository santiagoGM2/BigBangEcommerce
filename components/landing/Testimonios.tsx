"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconGoogle, IconLocalGuide } from "./icons";

// Reseñas reales de Google Maps segun el fragmento aprobado. Las fotos de
// perfil se descargaron desde Google (a 144x144, retina 2x del avatar de
// 40px) y viven en /public/avatars. Se sirven via next/image para
// convertirlas a AVIF/WebP a demanda. Si en el futuro falta alguna imagen,
// dejamos initials + avatarColor como fallback visual coherente con Google.
interface Review {
  stars: 5 | 4;
  text: React.ReactNode;
  initials: string;
  name: string;
  meta: string;
  avatarColor: string;
  /** Ruta local a la foto de perfil. Si es null se muestra el fallback de iniciales. */
  avatar: string | null;
}

const REVIEWS: Review[] = [
  {
    stars: 5,
    text: (
      <>
        &ldquo;Bastante surtido en accesorios, prendas y máscaras para
        disfraces. <em>Buenos precios.</em> Las capas de Harry Potter y
        elementos para el disfraz están muy buenos.&rdquo;
      </>
    ),
    initials: "CB",
    name: "Carlos Andrés Barrera",
    meta: "Cali · hace 5 meses",
    avatarColor: "#E91E8C",
    avatar: "/avatars/carlos-andres-barrera.png",
  },
  {
    stars: 5,
    text: (
      <>
        &ldquo;Excelente, este almacén tiene de todo para disfraces y fiestas:
        sombreros, máscaras, pelucas, gafas, accesorios, pinturas, decoración.{" "}
        <em>Es MUY completo el surtido.</em> Los precios son adecuados y hay
        opciones para todos los presupuestos. La atención es muy buena, son
        muy atentos y amables.&rdquo;
      </>
    ),
    initials: "CA",
    name: "Carlos Ardila Díaz",
    meta: "Cali · hace 5 meses",
    avatarColor: "#3D1A6E",
    avatar: "/avatars/carlos-ardila-diaz.png",
  },
  {
    stars: 5,
    text: (
      <>
        &ldquo;El precio de piñatería y decoración para fiestas me parece
        estándar. <em>Cuentan con gran variedad de productos.</em> Me gusta
        adquirir los regalos para los premios de mis celebraciones de
        cumpleaños, y su atención es buena.&rdquo;
      </>
    ),
    initials: "DP",
    name: "David Parra",
    meta: "Cali · hace 2 meses",
    avatarColor: "#7DC720",
    avatar: "/avatars/david-parra.png",
  },
  {
    stars: 5,
    text: (
      <>
        &ldquo;Excelente lugar, encuentras todo lo que buscas para decoración de
        fiestas. <em>Me encanta la atención</em> — sus empleados trabajan a
        gusto, tienen mucho carisma y son excelentes en lo que hacen. Siempre
        dispuestos a dar la mejor asesoría.&rdquo;
      </>
    ),
    initials: "DM",
    name: "Diana Montaño",
    meta: "Cali · hace 3 meses",
    avatarColor: "#E91E8C",
    avatar: "/avatars/diana-montano.png",
  },
  {
    stars: 4,
    text: (
      <>
        &ldquo;Este sitio es de los más completos en decoración para fiestas y
        souvenirs. <em>Tiene muchísima variedad y estilos</em> para elegir a
        nivel de temáticas. Lo único es que los pasillos son pequeños, pero es
        debido a la gran oferta de productos que tienen.&rdquo;
      </>
    ),
    initials: "HH",
    name: "Hanerth Hernández",
    meta: "Cali · hace 1 mes",
    avatarColor: "#3D1A6E",
    avatar: "/avatars/hanerth-hernandez.png",
  },
  {
    stars: 4,
    text: (
      <>
        &ldquo;<em>Variedad en juguetes, accesorios y complementos</em> para
        fiestas y reuniones. Buen lugar para encontrar todo lo que necesitas en
        un solo sitio.&rdquo;
      </>
    ),
    initials: "CC",
    name: "Christhian Cobo",
    meta: "Cali · hace 4 meses",
    avatarColor: "#7DC720",
    avatar: "/avatars/christhian-cobo.png",
  },
];

const GOOGLE_MAPS_URL =
  "https://www.google.com/maps/place/Pi%C3%B1atas+y+Regalos+Big+Bang";

function getPerView(width: number): number {
  if (width <= 600) return 1;
  if (width <= 900) return 2;
  return 3;
}

export function Testimonios() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [current, setCurrent] = useState(0);
  const [perView, setPerView] = useState(3);
  const total = REVIEWS.length;
  const maxIndex = Math.max(0, total - perView);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ajusta el numero de tarjetas visibles cuando cambia el ancho.
  useEffect(() => {
    function update() {
      setPerView(getPerView(window.innerWidth));
      setCurrent(0);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const goTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, Math.max(0, total - perView)));
      setCurrent(clamped);
    },
    [total, perView],
  );

  // Auto avance cada 5s, se reinicia al interactuar.
  useEffect(() => {
    if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    autoTimerRef.current = setInterval(() => {
      setCurrent((c) => (c >= maxIndex ? 0 : c + 1));
    }, 5000);
    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    };
  }, [maxIndex]);

  // Traduce el indice a translateX en px.
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const firstCard = track.querySelector<HTMLDivElement>(".bb-test-card");
    if (!firstCard) return;
    const cardWidth = firstCard.offsetWidth;
    const gap = 20;
    setOffset(current * (cardWidth + gap));
  }, [current, perView]);

  return (
    <div className="bb-test-root">
      <div className="bb-test-inner">
        <div className="bb-test-header">
          <div className="bb-test-label">Reseñas verificadas</div>
          <h2 className="bb-test-title">
            Lo que dicen nuestros <span>clientes</span>
          </h2>
          <p className="bb-test-subtitle">
            Reseñas reales de familias que celebraron con nosotros
          </p>
        </div>

        <a
          className="bb-test-rating-bar"
          href={GOOGLE_MAPS_URL}
          target="_blank"
          rel="noopener"
        >
          <div className="bb-rating-big">4.5</div>
          <div className="bb-rating-right">
            <div className="bb-stars-row">
              <span className="bb-star">★</span>
              <span className="bb-star">★</span>
              <span className="bb-star">★</span>
              <span className="bb-star">★</span>
              <span className="bb-star">★</span>
            </div>
            <div className="bb-rating-count">Basado en 513 reseñas</div>
          </div>
          <div className="bb-google-badge">
            <IconGoogle width={16} height={16} />
            Ver en Google Maps
          </div>
        </a>

        <div className="bb-test-carousel">
          <div className="bb-test-track-wrap">
            <div
              className="bb-test-track"
              ref={trackRef}
              style={{ transform: `translateX(-${offset}px)` }}
            >
              {REVIEWS.map((r, i) => (
                <div key={i} className="bb-test-card">
                  <div className="bb-card-stars">
                    {[0, 1, 2, 3, 4].map((s) => (
                      <span
                        key={s}
                        className={`bb-card-star${s >= r.stars ? " off" : ""}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <p className="bb-card-text">{r.text}</p>
                  <div className="bb-card-footer">
                    {/* Wrapper SIN overflow para que el badge Local Guide
                        pueda sobresalir del circulo. Antes descargabamos
                        las fotos con el badge naranja *dentro* del PNG
                        (parametro ba4-br100 de Google) y quedaba recortado
                        por el border-radius:50%. Ahora las fotos vienen
                        limpias y el badge se dibuja como capa aparte. */}
                    <div className="bb-card-avatar-wrap">
                      <div
                        className="bb-card-avatar"
                        style={
                          {
                            ["--avatar-bg" as string]: r.avatarColor,
                          } as React.CSSProperties
                        }
                      >
                        {r.avatar ? (
                          // Avatar de 40px, retina 2x -> pedimos 80x80.
                          // Fotos en /public/avatars son 144x144 sin badge.
                          <Image
                            src={r.avatar}
                            alt={r.name}
                            width={80}
                            height={80}
                          />
                        ) : (
                          r.initials
                        )}
                      </div>
                      <span
                        className="bb-card-avatar-badge"
                        aria-label="Google Local Guide"
                        title="Reseña verificada · Google Local Guide"
                      >
                        <IconLocalGuide width={16} height={16} />
                      </span>
                    </div>
                    <div>
                      <div className="bb-card-name">{r.name}</div>
                      <div className="bb-card-meta">{r.meta}</div>
                    </div>
                    <div className="bb-card-google">
                      <IconGoogle width={14} height={14} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bb-test-controls">
            <button
              type="button"
              className="bb-test-btn"
              onClick={() => goTo(current <= 0 ? maxIndex : current - 1)}
              aria-label="Anterior"
            >
              <IconChevronLeft width={16} height={16} />
            </button>
            <div className="bb-test-dots">
              {Array.from({ length: maxIndex + 1 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`bb-test-dot${i === current ? " active" : ""}`}
                  onClick={() => goTo(i)}
                  aria-label={`Ir a página ${i + 1}`}
                />
              ))}
            </div>
            <button
              type="button"
              className="bb-test-btn"
              onClick={() => goTo(current >= maxIndex ? 0 : current + 1)}
              aria-label="Siguiente"
            >
              <IconChevronRight width={16} height={16} />
            </button>
          </div>
        </div>

        <div className="bb-test-google-cta">
          <a href={GOOGLE_MAPS_URL} target="_blank" rel="noopener">
            <IconGoogle width={16} height={16} />
            Ver todas las reseñas en Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}
