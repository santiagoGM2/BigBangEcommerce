import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getConteoPorFamilia, getProductos } from "@/lib/catalogo";
import { FAMILIAS } from "@/lib/catalogo/familias-meta";
import { placeholderFamilia } from "@/lib/catalogo/placeholders";

export const metadata: Metadata = {
  title: "Catálogo completo",
  description:
    "Explora todas las familias de Piñatas y Regalos Big Bang: juguetes, piñatería, peluches, decoración, disfraces, dulcería y más en Cali.",
  alternates: { canonical: "/catalogo" },
};

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
          return (
            <li key={f.slug}>
              <Link
                href={`/catalogo/${f.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-tinta/8 bg-white transition hover:-translate-y-1 hover:shadow-lg"
                aria-label={`${f.nombre}: ${n.toLocaleString("es-CO")} productos`}
              >
                <div className="relative aspect-square w-full overflow-hidden bg-gris">
                  {/* Los SVG placeholders ya traen el nombre de la familia
                      renderizado adentro (JUGUETES + BIG BANG). Por eso el
                      caption inferior solo muestra el conteo — no repetimos
                      el nombre. Cuando llegue foto real y reemplacemos el
                      placeholder por foto de producto, restauramos el
                      nombre en el caption. */}
                  <Image
                    src={placeholderFamilia(f.slug)}
                    alt={f.nombre}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 48vw"
                    className="object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="text-xs font-bold text-tinta/70">
                    <span className="font-black text-tinta">
                      {n.toLocaleString("es-CO")}
                    </span>{" "}
                    productos
                  </div>
                  <span className="text-xs font-black text-rosa opacity-0 transition group-hover:opacity-100">
                    Ver →
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
