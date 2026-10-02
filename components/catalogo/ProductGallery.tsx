"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductImage } from "@/lib/catalogo/types";

export function ProductGallery({ images, fallback, description }: {
  images: ProductImage[]; fallback: string; description: string;
}) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const current = images.find(image => image.url === selectedUrl) ?? images[0];
  return (
    <section aria-label={`Fotos de ${description}`}>
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-tinta/8 bg-gris">
        <Image src={current?.url ?? fallback} alt={description} fill
          sizes="(min-width: 1024px) 500px, 100vw" className="object-contain" priority />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2" aria-label="Elegir fotografía">
          {images.map((image, index) => (
            <button key={image.order} type="button" onClick={() => setSelectedUrl(image.url)}
              aria-label={`Ver foto ${index + 1} de ${description}`} aria-pressed={image.url === current?.url}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-gris focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa ${image.url === current?.url ? "border-rosa" : "border-transparent"}`}>
              <Image src={image.url} alt="" fill sizes="80px" className="object-contain" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
