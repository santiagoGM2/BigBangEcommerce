import Image from "next/image";
import Link from "next/link";
import { FAMILIAS } from "@/lib/catalogo/familias-meta";
import { SITE } from "@/lib/seo/site";
import {
  IconFacebook,
  IconGoogle,
  IconInstagram,
  IconPhone,
  IconPin,
  IconTiktok,
  IconWhatsapp,
} from "./icons";

// Familias visibles en el footer. Se toman las 7 primeras (por orden ya
// pactado en familias-meta.ts) para que no crezca la columna cuando el
// mapa de familias cambie.
const FAMILIAS_FOOTER = FAMILIAS.slice(0, 7);

// URL rica de Google Maps (misma del fragmento original).
const GMAPS_URL =
  "https://www.google.com/maps/place/Pi%C3%B1atas+y+Regalos+Big+Bang/@3.4294697,-76.5391016,17z/data=!4m8!3m7!1s0x8e30a690b1d36c01:0xcc3c6dabe1908fc1!8m2!3d3.4294643!4d-76.5365267!9m1!1b1!16s%2Fg%2F1pycbw1mw";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bb-footer-root">
      <div className="bb-footer-wave" />
      <div className="bb-footer-bg-dots" />

      <div className="bb-footer-main">
        <div className="bb-footer-grid">
          {/* Marca */}
          <div>
            <div className="bb-footer-logo-wrap">
              {/* Logo a su proporcion real (382x217 -> ~92x52). Sin recorte
                  ni border-radius: el logo tiene su propia forma. */}
              <Image
                className="bb-footer-logo-img"
                src="/logo-big-bang.png"
                alt="Logo Piñatas y Regalos Big Bang"
                width={92}
                height={52}
                style={{ width: "auto", height: 52 }}
              />
              <div className="bb-footer-brand-name">
                Piñatas y Regalos
                <br />
                <span>Big Bang</span>
              </div>
            </div>
            <p className="bb-footer-tagline">
              Tu tienda favorita de piñatería, juguetería, disfraces y
              decoración para fiestas en Cali. ¡Todo para que tu celebración
              sea inolvidable!
            </p>
            <div className="bb-footer-socials">
              <a
                className="bb-footer-social-btn"
                href={SITE.whatsapp}
                target="_blank"
                rel="noopener"
                aria-label="WhatsApp"
              >
                <IconWhatsapp width={18} height={18} />
              </a>
              <a
                className="bb-footer-social-btn"
                href={SITE.redes.instagram}
                target="_blank"
                rel="noopener"
                aria-label="Instagram"
              >
                <IconInstagram width={18} height={18} />
              </a>
              <a
                className="bb-footer-social-btn"
                href={SITE.redes.facebook}
                target="_blank"
                rel="noopener"
                aria-label="Facebook"
              >
                <IconFacebook width={18} height={18} />
              </a>
              <a
                className="bb-footer-social-btn"
                href={SITE.redes.tiktok}
                target="_blank"
                rel="noopener"
                aria-label="TikTok"
              >
                <IconTiktok width={18} height={18} />
              </a>
            </div>
            <a
              className="bb-footer-wa-btn"
              href={SITE.whatsapp}
              target="_blank"
              rel="noopener"
            >
              <IconWhatsapp width={16} height={16} />
              Escríbenos al WhatsApp
            </a>
          </div>

          {/* Categorias — enlazadas a familias reales del catalogo */}
          <div>
            <div className="bb-footer-col-title">Categorías</div>
            <ul className="bb-footer-links">
              {FAMILIAS_FOOTER.map((f) => (
                <li key={f.slug}>
                  <Link href={`/catalogo/${f.slug}`}>{f.nombre}</Link>
                </li>
              ))}
              <li>
                <Link href="/catalogo">Ver todas las categorías</Link>
              </li>
            </ul>
          </div>

          {/* Informacion — solo enlaces a anclas de la landing porque las
              paginas legales aun no existen. Al no dejar hrefs "#" muertos,
              cada link va a algo real hasta que se creen las paginas. */}
          {/* TODO(cliente): las paginas Sobre Nosotros, Como Comprar, Envios,
              FAQ, Politica de Cambios y Trabaja con Nosotros no existen aun.
              Mientras tanto se enlazan a las secciones de la landing que
              cubren temas afines. */}
          <div>
            <div className="bb-footer-col-title">Información</div>
            <ul className="bb-footer-links">
              <li>
                <Link href="/#por-que">Sobre nosotros</Link>
              </li>
              <li>
                <a href={SITE.whatsapp} target="_blank" rel="noopener">
                  Cómo comprar
                </a>
              </li>
              <li>
                <Link href="/#por-que">Envíos y domicilios</Link>
              </li>
              <li>
                <a href={SITE.whatsapp} target="_blank" rel="noopener">
                  Preguntas frecuentes
                </a>
              </li>
              <li>
                <Link href="/#encuentranos">Contacto</Link>
              </li>
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <div className="bb-footer-col-title">Contacto</div>
            <div className="bb-footer-contact-list">
              <div className="bb-footer-contact-item">
                <div className="bb-footer-contact-icon">
                  <IconPhone width={16} height={16} strokeWidth="2" />
                </div>
                <div>
                  <div className="bb-footer-contact-label">
                    WhatsApp / Teléfono
                  </div>
                  <div className="bb-footer-contact-value">
                    <a href={SITE.whatsapp} target="_blank" rel="noopener">
                      {SITE.telefono}
                    </a>
                  </div>
                </div>
              </div>

              <div className="bb-footer-contact-item">
                <div className="bb-footer-contact-icon">
                  <IconPin width={16} height={16} strokeWidth="2" />
                </div>
                <div>
                  <div className="bb-footer-contact-label">Ubicación</div>
                  <div className="bb-footer-contact-value">
                    {SITE.direccion.ciudad}, {SITE.direccion.departamento}
                    <br />
                    {SITE.direccion.pais}
                  </div>
                </div>
              </div>
            </div>

            <div className="bb-footer-schedule">
              <div className="bb-footer-schedule-dot" />
              <div className="bb-footer-schedule-text">
                Lun – Sáb: 8:30 am – 6:30 pm
                <br />
                Dom: 9:00 am – 6:30 pm
              </div>
            </div>

            <a
              className="bb-footer-gmaps"
              href={GMAPS_URL}
              target="_blank"
              rel="noopener"
            >
              <IconGoogle width={18} height={18} />
              <div className="bb-footer-gmaps-text">
                <strong>Ver en Google Maps</strong>
                4.5 ★ · 513 reseñas
              </div>
            </a>
          </div>
        </div>

        <div className="bb-footer-bottom">
          <div className="bb-footer-bottom-left">
            © {year} {SITE.nombre}. Realizado por Grovia en Cali, Colombia.
          </div>
          {/* Paginas legales pendientes: mientras no existan, no dejamos
              anclas "#" muertas. Se anadiran cuando el cliente entregue
              los textos. */}
        </div>
      </div>
    </footer>
  );
}
