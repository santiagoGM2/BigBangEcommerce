import Link from "next/link";
import type { FamiliaSlug } from "@/lib/catalogo/familias-meta";
import { FAMILIAS_BY_SLUG } from "@/lib/catalogo/familias-meta";
import { IconChevronRight, IconHeart, IconSmile, IconStar } from "./icons";

// Las 4 familias destacadas en el fragmento original, en su orden visual.
// Se mapean a slugs reales del catalogo. Los conteos vienen de la capa de
// catalogo, nunca hardcodeados.
const DESTACADAS: {
  slug: FamiliaSlug;
  bgClass: string;
  Icon: (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
  subtitle: string;
}[] = [
  {
    slug: "juguetes",
    bgClass: "juguetes",
    Icon: IconStar,
    subtitle: "referencias",
  },
  {
    slug: "pinateria",
    bgClass: "pinateria",
    Icon: IconSmile,
    subtitle: "Piñatas y decoración",
  },
  {
    slug: "peluches",
    bgClass: "peluches",
    Icon: IconHeart,
    subtitle: "Para regalar con amor",
  },
  {
    slug: "decoracion-fiestas",
    bgClass: "deco",
    Icon: IconStar,
    subtitle: "Fiestas y eventos",
  },
];

interface CategoriasProps {
  conteo: Map<FamiliaSlug, number>;
}

export function Categorias({ conteo }: CategoriasProps) {
  return (
    <div className="bb-cats-root" id="categorias">
      <div className="bb-cats-header">
        <div className="bb-cats-label">Categorías</div>
        <h2 className="bb-cats-title">
          Encuentra lo que necesitas
          <br />
          para <span>celebrar</span>
        </h2>
      </div>

      <div className="bb-cats-grid">
        {DESTACADAS.map((cat) => {
          const familia = FAMILIAS_BY_SLUG[cat.slug];
          const n = conteo.get(cat.slug) ?? 0;
          // "juguetes" muestra "+N referencias", el resto usa el subtitle
          // literario. Regla del fragmento original: solo la primera tarjeta
          // llevaba el conteo textual.
          const bottom =
            cat.slug === "juguetes"
              ? `+${n.toLocaleString("es-CO")} ${cat.subtitle}`
              : cat.subtitle;
          return (
            <Link key={cat.slug} href={`/catalogo/${cat.slug}`} className="bb-cat-card">
              <div className={`bb-cat-bg ${cat.bgClass}`} />
              <div className="bb-cat-overlay" />
              <div className="bb-cat-icon-wrap">
                <cat.Icon width={72} height={72} stroke="#fff" fill="none" strokeWidth="1.2" />
              </div>
              <div className="bb-cat-info">
                <div className="bb-cat-name">{familia.nombre}</div>
                <div className="bb-cat-count">{bottom}</div>
              </div>
              <div className="bb-cat-arrow">
                <IconChevronRight width={13} height={13} stroke="#fff" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="bb-cats-cta">
        <Link href="/catalogo">
          Ver todo el catálogo
          <IconChevronRight width={15} height={15} />
        </Link>
      </div>
    </div>
  );
}
