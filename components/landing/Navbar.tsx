"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/carrito/CartContext";
import { FAMILIAS } from "@/lib/catalogo/familias-meta";
import { SITE } from "@/lib/seo/site";
import { IconBag, IconCart, IconChevronRight, IconWhatsapp } from "./icons";

// Logo original: 382x217 (aspect ratio ~1.76). En el navbar se muestra a 40px
// de alto (h-10). El CSS de .bb-nav-logo img fija esa altura y deja el ancho
// en auto para no deformarlo.
const LOGO_SRC = "/logo-big-bang.png";

// Enlaces del navbar. "Categorías" abre un mega-menu en hover con las 14
// familias; el click sigue funcionando y lleva al indice del catalogo.
interface NavLink {
  href: string;
  label: string;
  /** Marca este link como el que activa el mega-menu de familias. */
  megaMenu?: boolean;
}
const LINKS: NavLink[] = [
  { href: "/", label: "Inicio" },
  { href: "/catalogo", label: "Tienda" },
  { href: "/catalogo", label: "Categorías", megaMenu: true },
  { href: "/#por-que", label: "Nosotros" },
  { href: "/#encuentranos", label: "Contacto" },
];

/**
 * Decide si un link debe pintarse como "activo" en base al pathname actual.
 * Regla:
 *   - "/"                -> activo solo si pathname === "/"
 *   - "/algo"            -> activo si pathname == "/algo" o empieza por "/algo/"
 *   - "/#ancla"          -> nunca activo (son anclas de la landing)
 */
function isLinkActive(href: string, pathname: string): boolean {
  if (href.startsWith("/#")) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const [openMobile, setOpenMobile] = useState(false);
  const [openMega, setOpenMega] = useState(false);
  const { count, isHydrated } = useCart();
  const pathname = usePathname();

  return (
    <>
      <div className="bb-nav-root">
        <nav className="bb-nav">
          <Link href="/" className="bb-nav-logo" aria-label="Ir al inicio">
            {/* El alto lo controla el CSS de .bb-nav-logo img (40px). El
                width/height del prop dan aspect ratio al srcset. */}
            <Image
              src={LOGO_SRC}
              alt="Piñatas y Regalos Big Bang"
              width={70}
              height={40}
              priority
              style={{ width: "auto", height: 40 }}
            />
          </Link>

          <ul className="bb-nav-links">
            {LINKS.map((link, i) => (
              <li
                key={`${link.href}-${i}`}
                className={link.megaMenu ? "bb-nav-links-item-mega" : undefined}
                // Abre y cierra el mega en hover. Usar mouseleave del <li> (no
                // del <a>) permite mover el mouse al panel sin cerrarlo.
                onMouseEnter={() => link.megaMenu && setOpenMega(true)}
                onMouseLeave={() => link.megaMenu && setOpenMega(false)}
              >
                <Link
                  href={link.href}
                  className={isLinkActive(link.href, pathname) ? "active" : undefined}
                  aria-haspopup={link.megaMenu ? "menu" : undefined}
                  aria-expanded={link.megaMenu ? openMega : undefined}
                >
                  {link.label}
                </Link>
                {link.megaMenu && openMega && <CategoryMegaMenu onNavigate={() => setOpenMega(false)} />}
              </li>
            ))}
          </ul>

          <div className="bb-nav-right">
            <a href={SITE.whatsapp} target="_blank" rel="noopener" className="bb-wpp-pill">
              <IconWhatsapp width={13} height={13} />
              WhatsApp
            </a>
            <Link href="/catalogo" className="bb-nav-cta">
              <IconBag width={14} height={14} />
              Ver tienda
            </Link>
            <Link
              href="/carrito"
              className="bb-nav-cart"
              aria-label={
                isHydrated && count > 0
                  ? `Carrito con ${count} producto${count === 1 ? "" : "s"}`
                  : "Carrito"
              }
            >
              <IconCart width={18} height={18} />
              {/* El badge se muestra solo despues de hidratar para evitar
                  mismatch SSR (el server siempre renderiza sin badge). */}
              {isHydrated && count > 0 && (
                <span className="bb-nav-cart-badge">{count > 99 ? "99+" : count}</span>
              )}
            </Link>
            <button
              className="bb-hamburger"
              aria-label="Abrir menu"
              aria-expanded={openMobile}
              onClick={() => setOpenMobile(true)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </nav>
      </div>

      <div
        className={`bb-mobile-overlay${openMobile ? " open" : ""}`}
        onClick={() => setOpenMobile(false)}
      />
      <div className={`bb-mobile-menu${openMobile ? " open" : ""}`}>
        <div className="bb-mobile-header">
          <Image
            src={LOGO_SRC}
            alt="Big Bang"
            width={78}
            height={44}
            style={{ width: "auto", height: 44 }}
          />
          <button
            className="bb-mobile-close"
            aria-label="Cerrar menu"
            onClick={() => setOpenMobile(false)}
          >
            ✕
          </button>
        </div>
        <div className="bb-mobile-links">
          {LINKS.map((link, i) => (
            <Link
              key={`${link.href}-${i}`}
              href={link.href}
              onClick={() => setOpenMobile(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/carrito" onClick={() => setOpenMobile(false)}>
            Carrito{isHydrated && count > 0 ? ` (${count})` : ""}
          </Link>
        </div>
        <div className="bb-mobile-footer">
          <Link href="/catalogo" className="bb-nav-cta" onClick={() => setOpenMobile(false)}>
            Ver tienda
          </Link>
          <a href={SITE.whatsapp} target="_blank" rel="noopener" className="bb-wpp-pill">
            +57 321 558 1600
          </a>
        </div>
      </div>
    </>
  );
}

/**
 * Panel desplegable con las 14 familias, en 2 columnas.
 * Solo desktop (el mismo <li> padre esta oculto en mobile via .bb-nav-links
 * que ya se esconde en <= 900px, junto con el mega).
 */
function CategoryMegaMenu({ onNavigate }: { onNavigate: () => void }) {
  // Dividir 14 familias en 2 columnas: primera 7, segunda 7.
  const half = Math.ceil(FAMILIAS.length / 2);
  const colA = FAMILIAS.slice(0, half);
  const colB = FAMILIAS.slice(half);

  return (
    <div className="bb-mega" role="menu">
      <div className="bb-mega-cols">
        {[colA, colB].map((col, i) => (
          <ul key={i} className="bb-mega-col">
            {col.map((f) => (
              <li key={f.slug}>
                <Link
                  href={`/catalogo/${f.slug}`}
                  onClick={onNavigate}
                  role="menuitem"
                >
                  {f.nombre}
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </div>
      <Link href="/catalogo" onClick={onNavigate} className="bb-mega-footer">
        Ver catálogo completo
        <IconChevronRight width={14} height={14} />
      </Link>
    </div>
  );
}
