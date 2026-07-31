import Image from "next/image";
import Link from "next/link";
import type { FamiliaMeta } from "@/lib/catalogo/familias-meta";
import { FAMILIAS } from "@/lib/catalogo/familias-meta";
import type { FamiliaSlug } from "@/lib/catalogo/familias-meta";
import { iconoFamilia } from "@/lib/catalogo/placeholders";
import { fotoCategoriaSiExiste } from "@/lib/catalogo/placeholders.server";
import { IconChevronRight } from "./icons";

interface CategoriasProps {
  conteo: Map<FamiliaSlug, number>;
}

/**
 * Seccion "Categorias" de la landing. Panel interior con degradado sutil
 * (rosa/verde/morado en glows radiales apenas visibles), cuadricula 2x7 en
 * desktop que muestra las 14 familias completas. En tablet colapsa a 4 col,
 * en mobile a 2 col.
 *
 * Cada tarjeta usa la foto personalizada en /public/categorias/{slug}.png
 * si existe; si no, cae automaticamente al SVG icon-only de la familia.
 * Se decide en server: fotoCategoriaSiExiste() chequea el disco durante SSR.
 */
export function Categorias({ conteo }: CategoriasProps) {
  return (
    <div className="bb-cats-root" id="categorias">
      {/* El fondo exterior gris #F7F7F7 lo pone .bb-cats-root (sin cambios).
          Adentro va el panel de bordes redondeados con el degradado sutil. */}
      <div className="bb-cats-panel">
        <div className="bb-cats-panel-glow" aria-hidden="true" />

        <div className="bb-cats-header">
          <div className="bb-cats-label">Categorías</div>
          <h2 className="bb-cats-title">
            Encuentra lo que necesitas
            <br />
            para <span>celebrar</span>
          </h2>
        </div>

        <ul className="bb-cats-grid-14">
          {FAMILIAS.map((f) => (
            <li key={f.slug}>
              <CategoriaTarjeta familia={f} conteo={conteo.get(f.slug) ?? 0} />
            </li>
          ))}
        </ul>

        <div className="bb-cats-cta">
          <Link href="/catalogo">
            Ver todo el catálogo
            <IconChevronRight width={15} height={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function CategoriaTarjeta({
  familia,
  conteo,
}: {
  familia: FamiliaMeta;
  conteo: number;
}) {
  // Server-side: decidir aca si mostramos foto real o el icono placeholder.
  // Cuando el cliente suba una foto a /public/categorias/{slug}.png, esta
  // rama automaticamente empieza a servir esa imagen sin tocar codigo.
  const foto = fotoCategoriaSiExiste(familia.slug);
  const src = foto ?? iconoFamilia(familia.slug);

  return (
    <Link
      href={`/catalogo/${familia.slug}`}
      className="bb-cat14"
      aria-label={`${familia.nombre}: ${conteo.toLocaleString("es-CO")} productos`}
    >
      <div className="bb-cat14-thumb">
        <Image
          src={src}
          alt={familia.nombre}
          fill
          sizes="(min-width: 1200px) 130px, (min-width: 820px) 22vw, 44vw"
          className="bb-cat14-img"
        />
      </div>
      <div className="bb-cat14-name">{familia.nombre}</div>
      <div className="bb-cat14-count">
        {conteo.toLocaleString("es-CO")} productos
      </div>
    </Link>
  );
}
