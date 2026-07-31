import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getConteoPorFamilia, getProductos } from "@/lib/catalogo";
import { FAMILIAS } from "@/lib/catalogo/familias-meta";
import { iconoFamilia } from "@/lib/catalogo/placeholders";
import { fotoCategoriaSiExiste } from "@/lib/catalogo/placeholders.server";

export const metadata: Metadata = {
  title: "Catálogo completo",
  description:
    "Explora todas las familias de Piñatas y Regalos Big Bang: juguetes, piñatería, peluches, decoración, disfraces, dulcería y más en Cali.",
  alternates: { canonical: "/catalogo" },
};

// ISR igual que la landing: cuando el cliente suba una foto nueva a
// /public/categorias/{slug}.png, se detecta en la siguiente revalidacion
// (5 min), sin rebuild manual. Ver comentario en (site)/page.tsx.
export const revalidate = 300;

export default async function CatalogoIndex() {
  const [productos, conteo] = await Promise.all([
    getProductos(),
    getConteoPorFamilia(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10 text-center">
        <div className="mb-3 inline-block rounded-full bg-rosa/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-rosa">
          Nuestro catálogo
        </div>
        <h1 className="text-3xl font-black tracking-tight text-tinta sm:text-4xl">
          Todo para tu <span className="text-rosa">próxima fiesta</span>,
          <br className="hidden sm:block" /> en un solo lugar
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-tinta/60">
          Explora nuestras 14 familias con más de{" "}
          <strong className="text-tinta">
            {productos.length.toLocaleString("es-CO")}
          </strong>{" "}
          productos actualizados en vivo desde nuestra tienda en Cali.
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {FAMILIAS.map((f) => {
          const n = conteo.get(f.slug) ?? 0;
          // Misma logica que la seccion "Categorias" de la landing:
          // foto personalizada en /public/categorias/{slug}.png si existe,
          // si no cae al SVG icon-only (sin texto embebido — el nombre lo
          // ponemos abajo en HTML). Asi el diseno es consistente y cuando
          // haya foto real no se superpone texto encima.
          const foto = fotoCategoriaSiExiste(f.slug);
          const src = foto ?? iconoFamilia(f.slug);
          return (
            <li key={f.slug}>
              <Link
                href={`/catalogo/${f.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-tinta/8 bg-white transition hover:-translate-y-1 hover:shadow-lg"
                aria-label={`${f.nombre}: ${n.toLocaleString("es-CO")} productos`}
              >
                <div className="relative aspect-square w-full overflow-hidden bg-gris">
                  <Image
                    src={src}
                    alt={f.nombre}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 48vw"
                    className="object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <div className="text-sm font-black uppercase tracking-wide text-tinta">
                    {f.nombre}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-tinta/60">
                      <span className="text-tinta">
                        {n.toLocaleString("es-CO")}
                      </span>{" "}
                      productos
                    </div>
                    <span className="text-xs font-black text-rosa opacity-0 transition group-hover:opacity-100">
                      Ver →
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
