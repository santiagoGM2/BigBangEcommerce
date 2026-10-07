import type { Metadata } from "next";
import { serializeJsonLd } from "@/lib/seo/serialize-json-ld";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getProductoPorId } from "@/lib/catalogo";
import { FAMILIAS_BY_SLUG } from "@/lib/catalogo/familias-meta";
import { formatearPrecio } from "@/lib/catalogo/formato";
import { placeholderFamilia } from "@/lib/catalogo/placeholders";
import { extraerIdItem } from "@/lib/catalogo/slug";
import { SITE } from "@/lib/seo/site";
import { AddToCartButton } from "@/components/carrito/AddToCartButton";
import { BuyNowButton } from "@/components/carrito/BuyNowButton";
import { IconWhatsapp } from "@/components/landing/icons";
import { ProductGallery } from "@/components/catalogo/ProductGallery";

// NO usamos generateStaticParams: son ~16.000 productos y prerenderizar
// todo agranda el build de forma innecesaria. Cada URL se sirve bajo demanda
// la primera vez (cold miss) y queda cacheada por Next hasta la proxima
// revalidacion. Ver CLAUDE.md > Trampas conocidas de Next 16.

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function resolverProducto(slug: string) {
  const id = extraerIdItem(slug);
  if (!id) return null;
  return getProductoPorId(id);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const producto = await resolverProducto(slug);
  if (!producto) return {};
  const familia = FAMILIAS_BY_SLUG[producto.familia];
  return {
    title: `${producto.descripcion_mostrable} · ${familia.nombre}`,
    description: `${producto.descripcion_mostrable} disponible en Piñatas y Regalos Big Bang, Cali. ${familia.seo.description}`,
    alternates: { canonical: `/producto/${producto.slug}` },
  };
}

export default async function ProductoPage({ params }: PageProps) {
  const { slug } = await params;
  const producto = await resolverProducto(slug);

  // id_item invalido o inexistente -> 404 real (no una pagina vacia con 200).
  if (!producto) notFound();

  // Slug no canonico -> 308 al canonico. Alguien puede llegar con el id
  // solo ("-000002") o con la descripcion mutada; siempre normalizamos.
  if (slug !== producto.slug) {
    permanentRedirect(`/producto/${producto.slug}`);
  }

  const familia = FAMILIAS_BY_SLUG[producto.familia];
  const foto = producto.foto_url ?? placeholderFamilia(producto.familia);

  // Mensaje pre-armado para WhatsApp. Hasta que ePayco este activo y el
  // carrito funcione, este es el CTA principal (el cliente compra por
  // WhatsApp de todas formas hoy).
  const mensaje = `Hola, me interesa el producto: ${producto.descripcion_mostrable} (código ${producto.id_item}). ¿Está disponible?`;
  const waHref = `https://api.whatsapp.com/send?phone=573215581600&text=${encodeURIComponent(mensaje)}`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <nav className="mb-6 text-sm text-tinta/60" aria-label="Miga de pan">
        <Link href="/catalogo" className="hover:text-rosa">
          Catálogo
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/catalogo/${producto.familia}`} className="hover:text-rosa">
          {familia.nombre}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-tinta">{producto.descripcion_mostrable}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={producto.images} fallback={foto} description={producto.descripcion_mostrable} />

        <div className="flex flex-col gap-5">
          <div>
            <Link
              href={`/catalogo/${producto.familia}`}
              className="text-xs font-black uppercase tracking-widest text-rosa hover:underline"
            >
              {familia.nombre}
            </Link>
            <h1 className="mt-2 text-2xl font-black leading-tight text-tinta sm:text-3xl">
              {producto.descripcion_mostrable}
            </h1>
            <div className="mt-1 text-xs text-tinta/50">
              Código: {producto.id_item}
              {producto.codigo_barra && ` · Barras: ${producto.codigo_barra}`}
            </div>
          </div>

          <div className="flex items-baseline gap-3">
            <div className="text-4xl font-black text-verde">
              {formatearPrecio(producto.precio)}
            </div>
            {producto.precio_fuente === "respaldo_mayorista" && (
              <span className="rounded-full bg-morado/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-morado">
                Precio mayorista
              </span>
            )}
          </div>

          {/* NO mostramos "agotado" ni deshabilitamos el CTA por existencias:
              existencias siempre llega null desde el ERP por ahora, no
              tenemos senal real de stock. Ver CLAUDE.md > Datos del catalogo. */}

          <div className="flex flex-col gap-3">
            {/* CTAs primarios: agregar al carrito + comprar ahora (atajo
                para quien ya decidio y no quiere pasar por el listado). */}
            <div className="grid gap-3 sm:grid-cols-2">
              <AddToCartButton idItem={producto.id_item} />
              <BuyNowButton idItem={producto.id_item} />
            </div>
            {/* CTA secundario: WhatsApp. Aca en Colombia la venta por chat
                sigue siendo comun; no lo escondemos, pero es opcion B. */}
            <a
              href={waHref}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-whatsapp bg-white px-6 py-3 text-sm font-black text-whatsapp transition hover:bg-whatsapp hover:text-white"
            >
              <IconWhatsapp width={18} height={18} />
              O consulta por WhatsApp
            </a>
            <p className="text-center text-xs text-tinta/50">
              Envíos a toda Colombia · Respuesta en menos de 2 horas
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-tinta/8 bg-white p-5 text-sm text-tinta/70">
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-tinta">
              ¿Cómo comprar?
            </div>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Escríbenos por WhatsApp con el código o el enlace del producto.</li>
              <li>Confirmamos disponibilidad y coordinamos envío o retiro.</li>
              <li>
                Pagas seguro y despachamos desde{" "}
                <Link href="/#encuentranos" className="text-rosa hover:underline">
                  nuestra tienda en Cali
                </Link>
                .
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* JSON-LD del producto, con precios y disponibilidad segun lo que
          hoy nos entrega el ERP. No incluye stock porque existencias siempre
          es null; si en el futuro llega con datos, se agrega availability. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd({
            "@context": "https://schema.org",
            "@type": "Product",
            name: producto.descripcion_mostrable,
            sku: producto.id_item,
            category: familia.nombre,
            image: producto.images.length ? producto.images.map(image => image.url) : producto.foto_url ?? undefined,
            offers: {
              "@type": "Offer",
              url: `${SITE.url}/producto/${producto.slug}`,
              priceCurrency: "COP",
              price: producto.precio,
              seller: { "@type": "Organization", name: SITE.nombre },
            },
          }),
        }}
      />
    </main>
  );
}
