import Image from "next/image";
import Link from "next/link";
import { AddToCartButton } from "@/components/carrito/AddToCartButton";
import { formatearPrecio } from "@/lib/catalogo/formato";
import { placeholderFamilia } from "@/lib/catalogo/placeholders";
import type { ProductoEnriquecido } from "@/lib/catalogo/types";
import { FAMILIAS_BY_SLUG } from "@/lib/catalogo/familias-meta";

interface ProductCardProps {
  producto: ProductoEnriquecido;
  /** Si es true muestra tambien el nombre de la familia (util en listados mixtos). */
  mostrarFamilia?: boolean;
  /** Tamano del <Image>; controla sizes del srcset. Default: cuadricula. */
  variant?: "grid" | "hero";
}

export function ProductCard({
  producto,
  mostrarFamilia = false,
  variant = "grid",
}: ProductCardProps) {
  const foto = producto.foto_url ?? placeholderFamilia(producto.familia);
  const familia = FAMILIAS_BY_SLUG[producto.familia];

  // sizes: en grid mostramos 2 col en mobile, 3 col en tablet, 4 col en desktop.
  // Con max-w-6xl y padding, en desktop cada tile ~250px, en tablet ~230px,
  // en mobile ~48vw. Le pedimos a next/image que sirva la imagen correcta
  // segun ese tamano.
  const sizes =
    variant === "grid"
      ? "(min-width: 1024px) 250px, (min-width: 640px) 33vw, 48vw"
      : "(min-width: 1024px) 500px, 90vw";

  return (
    <Link
      href={`/producto/${producto.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-tinta/8 bg-white transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-gris">
        <Image
          src={foto}
          alt={producto.descripcion_mostrable}
          fill
          sizes={sizes}
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        {mostrarFamilia && (
          <div className="text-[10px] font-black uppercase tracking-wide text-rosa">
            {familia.nombre}
          </div>
        )}
        <div className="line-clamp-2 text-sm font-extrabold text-tinta">
          {producto.descripcion_mostrable}
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="min-w-0">
            <div className="text-lg font-black leading-none text-verde">
              {formatearPrecio(producto.precio)}
            </div>
            {producto.precio_fuente === "respaldo_mayorista" && (
              // Etiqueta discreta para los ~698 productos que solo tienen lista
              // mayorista. No los ocultamos (flag OCULTAR_RESPALDO_MAYORISTA
              // esta en false), pero avisamos al usuario que es un producto
              // pensado para revendedores.
              <span className="mt-1 inline-block rounded-full bg-morado/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-morado">
                Mayorista
              </span>
            )}
          </div>
          <AddToCartButton idItem={producto.id_item} variant="compact" />
        </div>
      </div>
    </Link>
  );
}
