import Image from "next/image";
import { FAMILIAS, FAMILIAS_BY_SLUG } from "@/lib/catalogo/familias-meta";
import { getConteoPorFamilia, getProductos } from "@/lib/catalogo";
import { placeholderFamilia } from "@/lib/catalogo/placeholders";

// Pagina interna de diagnostico (heredada de la Fase 1). Sirve para verificar
// tokens de marca, pesos de tipografia, la capa de catalogo en vivo y los 14
// placeholders. No linkeada desde ningun lado en la UI publica.

export const metadata = {
  title: "Debug interno",
  robots: { index: false, follow: false },
};

export default async function Debug() {
  const [productos, conteo] = await Promise.all([
    getProductos(),
    getConteoPorFamilia(),
  ]);

  const ejemplo = productos[0];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-12">
        <h1 className="text-5xl font-black tracking-tight text-tinta">
          Debug interno · Fase 1
        </h1>
        <p className="mt-3 text-lg text-tinta/70">
          Cimientos y datos reales del ERP. No indexable.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-extrabold">Tokens de marca</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {[
            { name: "rosa", cls: "bg-rosa" },
            { name: "verde", cls: "bg-verde" },
            { name: "morado", cls: "bg-morado" },
            { name: "tinta", cls: "bg-tinta" },
            { name: "gris", cls: "bg-gris text-tinta" },
            { name: "whatsapp", cls: "bg-whatsapp" },
          ].map((c) => (
            <div
              key={c.name}
              className={`${c.cls} flex h-20 items-center justify-center rounded-lg text-sm font-bold text-white`}
            >
              {c.name}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-extrabold">Pesos de Nunito</h2>
        <div className="space-y-1">
          <p className="text-2xl font-normal">400 · Regular · The quick brown fox</p>
          <p className="text-2xl font-semibold">600 · SemiBold · The quick brown fox</p>
          <p className="text-2xl font-bold">700 · Bold · The quick brown fox</p>
          <p className="text-2xl font-extrabold">800 · ExtraBold · The quick brown fox</p>
          <p className="text-2xl font-black">900 · Black · The quick brown fox</p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-extrabold">
          Catalogo en vivo · {productos.length.toLocaleString("es-CO")} productos publicables
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {FAMILIAS.map((f) => (
            <div
              key={f.slug}
              className="overflow-hidden rounded-lg bg-gris shadow-sm"
            >
              <div className="relative aspect-square w-full">
                <Image
                  src={placeholderFamilia(f.slug)}
                  alt={f.nombre}
                  fill
                  className="object-cover"
                  sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                />
              </div>
              <div className="p-3">
                <div className="text-sm font-black uppercase tracking-wide text-tinta">
                  {f.nombre}
                </div>
                <div className="text-xs text-tinta/60">
                  {(conteo.get(f.slug) ?? 0).toLocaleString("es-CO")} productos
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {ejemplo && (
        <section>
          <h2 className="mb-4 text-2xl font-extrabold">Producto de ejemplo</h2>
          <div className="rounded-lg border border-tinta/10 p-6">
            <div className="text-xs uppercase tracking-wide text-rosa">
              {FAMILIAS_BY_SLUG[ejemplo.familia].nombre}
            </div>
            <div className="mt-1 text-lg font-extrabold">
              {ejemplo.descripcion_mostrable}
            </div>
            <div className="mt-2 text-sm text-tinta/60">
              id_item={ejemplo.id_item} · slug=/producto/{ejemplo.slug}
            </div>
            <div className="mt-3 text-2xl font-black text-verde">
              ${ejemplo.precio.toLocaleString("es-CO")}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
