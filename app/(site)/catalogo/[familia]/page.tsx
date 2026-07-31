import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect, permanentRedirect } from "next/navigation";
import { getConteoPorFamilia, getProductosDeFamilia } from "@/lib/catalogo";
import {
  FAMILIAS,
  FAMILIAS_BY_SLUG,
  isFamiliaSlug,
} from "@/lib/catalogo/familias-meta";
import { Paginacion } from "@/components/catalogo/Paginacion";
import { ProductCard } from "@/components/catalogo/ProductCard";

const POR_PAGINA = 24;

// Genera params estaticos para las 14 familias. Cada tarjeta se prerenderiza
// una vez y luego la revalidacion la maneja el cache del catalogo.
export function generateStaticParams() {
  return FAMILIAS.map((f) => ({ familia: f.slug }));
}

interface PageProps {
  params: Promise<{ familia: string }>;
  searchParams: Promise<{ page?: string }>;
}

// La metadata se resuelve por request para poder devolver 404 (via notFound)
// cuando la familia no existe. Ademas fija el canonical: la pagina 1 canoniza
// al path pelado, cualquier otra pagina agrega ?page=N.
export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { familia } = await params;
  const { page: pageRaw } = await searchParams;
  if (!isFamiliaSlug(familia)) return {};
  const meta = FAMILIAS_BY_SLUG[familia];
  const page = parseInt(pageRaw ?? "1", 10);
  const canonical =
    page > 1 ? `/catalogo/${familia}?page=${page}` : `/catalogo/${familia}`;
  return {
    title: page > 1 ? `${meta.seo.title} · Página ${page}` : meta.seo.title,
    description: meta.seo.description,
    alternates: { canonical },
  };
}

export default async function FamiliaPage({ params, searchParams }: PageProps) {
  const { familia } = await params;
  const { page: pageRaw } = await searchParams;

  // Familia inexistente -> 404 real.
  if (!isFamiliaSlug(familia)) notFound();

  // ?page=1 -> 308 al canonico sin el parametro.
  if (pageRaw === "1") permanentRedirect(`/catalogo/${familia}`);

  // Cualquier valor que no sea entero positivo -> normalizamos a 1 redirigiendo
  // (temporary, porque la URL rara probablemente no esta indexada).
  const paginaSolicitada = pageRaw ? parseInt(pageRaw, 10) : 1;
  if (pageRaw !== undefined && (!Number.isInteger(paginaSolicitada) || paginaSolicitada < 1)) {
    redirect(`/catalogo/${familia}`);
  }

  const [productos, conteo] = await Promise.all([
    getProductosDeFamilia(familia),
    getConteoPorFamilia(),
  ]);
  const total = productos.length;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  // Pagina fuera de rango. En vez de 404 hacemos redirect a la ultima
  // pagina real: si alguien guardo ?page=99 y la familia se redujo, no
  // queremos romperle el bookmark.
  if (paginaSolicitada > totalPaginas) {
    redirect(
      totalPaginas === 1
        ? `/catalogo/${familia}`
        : `/catalogo/${familia}?page=${totalPaginas}`,
    );
  }

  const inicio = (paginaSolicitada - 1) * POR_PAGINA;
  const visibles = productos.slice(inicio, inicio + POR_PAGINA);
  const meta = FAMILIAS_BY_SLUG[familia];
  const conteoTotal = conteo.get(familia) ?? total;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <nav className="mb-4 text-sm text-tinta/60" aria-label="Miga de pan">
        <Link href="/catalogo" className="hover:text-rosa">
          Catálogo
        </Link>
        <span className="mx-2">/</span>
        <span className="text-tinta">{meta.nombre}</span>
      </nav>

      <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-tinta sm:text-4xl">
            {meta.nombre}
          </h1>
          <p className="mt-2 max-w-2xl text-tinta/60">{meta.seo.description}</p>
        </div>
        <div className="text-sm text-tinta/60">
          <span className="font-black text-tinta">
            {conteoTotal.toLocaleString("es-CO")}
          </span>{" "}
          productos ·{" "}
          <span>
            página {paginaSolicitada} de {totalPaginas}
          </span>
        </div>
      </header>

      {visibles.length === 0 ? (
        <div className="rounded-xl border border-tinta/10 bg-white p-10 text-center">
          <p className="text-tinta/70">
            Todavía no hay productos publicables en esta familia.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
          {visibles.map((p) => (
            <li key={p.id_item}>
              <ProductCard producto={p} />
            </li>
          ))}
        </ul>
      )}

      <Paginacion
        paginaActual={paginaSolicitada}
        totalPaginas={totalPaginas}
        basePath={`/catalogo/${familia}`}
      />
    </main>
  );
}
