import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/lib/seo/site";
import { IconBag, IconChat, IconShield, IconStore, IconTruck, IconWhatsapp } from "./icons";

// Textos del ticker superior. El fragmento original incluia "Paga seguro con
// PayU"; ePayco es la pasarela real elegida y la cuenta aun no esta activa,
// asi que se usa una frase neutra mientras tanto.
const TICKER_ITEMS = [
  "Envíos a toda Colombia",
  "Juguetes, piñatería y peluches",
  "Ventas al por mayor y detal",
  "Decoración para fiestas",
  "Pago seguro en línea",
  "Atención por WhatsApp",
];

interface HeroProps {
  totalProductos: number;
}

export function Hero({ totalProductos }: HeroProps) {
  // Redondeamos hacia abajo al millar mas cercano para que el numero luzca
  // estable ante pequenas variaciones del ERP: si un dia hay 15.891 y otro
  // dia hay 15.905, ambos se muestran como "+15.000". Es honesto (siempre
  // MAS que lo mostrado) y no obliga a reescribir la landing por 14 items.
  const magnitud = Math.max(500, Math.floor(totalProductos / 1000) * 1000);

  // La secuencia se repite 2x para que la animacion CSS translateX(-50%)
  // parezca continua sin cortes.
  const trackItems = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div className="bb-hero-root">
      <div className="bb-ticker">
        <div className="bb-ticker-track">
          {trackItems.map((text, i) => (
            <span key={i} className="bb-ticker-item">
              {text} <span className="bb-ticker-star">★</span>
            </span>
          ))}
        </div>
      </div>

      <div className="bb-hero">
        <div className="bb-hero-pattern" />
        <div className="bb-hero-glow" />
        <div className="bb-hero-glow2" />

        <div className="bb-hero-left">
          <div className="bb-hero-badge">
            <div className="bb-badge-chip">Cali, Colombia</div>
            <div className="bb-badge-line" />
            <div className="bb-badge-text">Piñatería &amp; Juguetería</div>
          </div>
          <h1 className="bb-hero-title">
            La magia de<br />
            cada <span className="accent">fiesta</span><br />
            empieza <span className="highlight">aquí</span>
          </h1>
          <p className="bb-hero-sub">
            Juguetes, piñatas, peluches y decoración para hacer de cada
            celebración un momento inolvidable. Envíos a toda Colombia.
          </p>
          <div className="bb-hero-actions">
            <Link href="/catalogo" className="bb-btn-primary">
              <IconBag width={15} height={15} />
              Ver productos
            </Link>
            <a href={SITE.whatsapp} target="_blank" rel="noopener" className="bb-btn-ghost">
              <IconWhatsapp width={14} height={14} />
              Escríbenos
            </a>
          </div>
          <div className="bb-hero-stats">
            <div>
              <div className="bb-stat-num">
                +<span>{magnitud.toLocaleString("es-CO")}</span>
              </div>
              <div className="bb-stat-label">Productos</div>
            </div>
            <div>
              <div className="bb-stat-num small">
                Mayor <span className="verde">y detal</span>
              </div>
              <div className="bb-stat-label">Ventas</div>
            </div>
            <div>
              <div className="bb-stat-num small">
                Toda <span className="verde">Colombia</span>
              </div>
              <div className="bb-stat-label">Envíos</div>
            </div>
          </div>
        </div>

        <div className="bb-hero-right">
          {/* Imagen del hero (1536x1024, aspect ratio ~1.5). Vive full-fill
              dentro de la columna derecha; el contenedor tiene position
              relative y aspect-ratio libre, y la Image usa object-contain
              para no deformarla. priority porque es above-the-fold. */}
          <Image
            src="/herosection.png"
            alt="Big Bang: piñatas, juguetes y decoración para fiestas en Cali"
            fill
            sizes="(min-width: 1440px) 640px, (min-width: 820px) 45vw, 100vw"
            className="bb-hero-image"
            priority
          />
        </div>
      </div>

      <div className="bb-trust">
        <div className="bb-trust-item">
          <div className="bb-trust-icon">
            <IconTruck width={17} height={17} stroke="#E91E8C" />
          </div>
          <div className="bb-trust-text">
            <strong>Envíos a Colombia</strong>
            <span>Rápido y seguro</span>
          </div>
        </div>
        <div className="bb-trust-item">
          <div className="bb-trust-icon">
            <IconShield width={17} height={17} stroke="#E91E8C" />
          </div>
          <div className="bb-trust-text">
            <strong>Pago 100% seguro</strong>
            {/* Reemplazo intencional: el fragmento original decia "PayU y mas
                metodos". La pasarela real elegida es ePayco y la cuenta aun
                no esta lista; hasta que se active se muestra algo neutro. */}
            <span>Pago seguro en línea</span>
          </div>
        </div>
        <div className="bb-trust-item">
          <div className="bb-trust-icon">
            <IconStore width={17} height={17} stroke="#E91E8C" />
          </div>
          <div className="bb-trust-text">
            <strong>Mayor y detal</strong>
            <span>Precios para todos</span>
          </div>
        </div>
        <div className="bb-trust-item">
          <div className="bb-trust-icon">
            <IconChat width={17} height={17} stroke="#E91E8C" />
          </div>
          <div className="bb-trust-text">
            <strong>WhatsApp directo</strong>
            <span>Lun–Sáb 8:30–18:30 · Dom 9:00–18:30</span>
          </div>
        </div>
      </div>
    </div>
  );
}
