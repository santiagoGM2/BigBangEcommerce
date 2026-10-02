"use client";

import Image from "next/image";
import { useRef, useState, type PointerEvent } from "react";
import type { ProductImage } from "@/lib/catalogo/types";

export function ProductGallery({ images, fallback, description }: {
  images: ProductImage[]; fallback: string; description: string;
}) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, images.findIndex(image => image.url === selectedUrl));
  const current = images[selectedIndex];
  const canZoom = Boolean(current);

  function moveZoom(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "mouse" || !imageRef.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    // La posicion del cursor solo actualiza el origen de la transformacion.
    // No vuelve a renderizar la galeria por cada movimiento.
    const x = Math.max(0, Math.min(100, (event.clientX - bounds.left) / bounds.width * 100));
    const y = Math.max(0, Math.min(100, (event.clientY - bounds.top) / bounds.height * 100));
    imageRef.current.style.transformOrigin = `${x}% ${y}%`;
  }

  function selectImage(index: number) {
    if (!images.length) return;
    const next = (index + images.length) % images.length;
    const image = images[next];
    if (!image) return;
    setSelectedUrl(image.url);
    setZoomed(false);
    if (imageRef.current) imageRef.current.style.transformOrigin = "50% 50%";
    const strip = thumbnailsRef.current;
    const thumbnail = strip?.children[next] as HTMLElement | undefined;
    // Desplaza solo las miniaturas, sin mover verticalmente la pagina.
    if (strip && thumbnail) {
      if (thumbnail.offsetLeft < strip.scrollLeft) strip.scrollLeft = thumbnail.offsetLeft;
      else if (thumbnail.offsetLeft + thumbnail.offsetWidth > strip.scrollLeft + strip.clientWidth) {
        strip.scrollLeft = thumbnail.offsetLeft + thumbnail.offsetWidth - strip.clientWidth;
      }
    }
  }

  return (
    <section aria-label={`Fotos de ${description}`} onKeyDown={event => {
      if (event.key === "Escape") setZoomed(false);
      if (images.length > 1 && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        selectImage(selectedIndex + (event.key === "ArrowRight" ? 1 : -1));
      }
    }}>
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-tinta/8 bg-gris">
        <button type="button" disabled={!canZoom}
          aria-label={`${zoomed ? "Reducir" : "Ampliar"} foto ${selectedIndex + 1} de ${description}`}
          aria-pressed={zoomed}
          onPointerEnter={event => {
            if (event.pointerType === "mouse" && canZoom) {
              moveZoom(event);
              setZoomed(true);
            }
          }}
          onPointerMove={moveZoom}
          onPointerLeave={event => {
            if (event.pointerType === "mouse") setZoomed(false);
          }}
          onBlur={() => setZoomed(false)}
          onClick={() => setZoomed(value => !value)}
          className={`absolute inset-0 h-full w-full overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-rosa disabled:cursor-default ${zoomed ? "cursor-zoom-out" : "cursor-zoom-in"}`}>
          <div ref={imageRef} className={`absolute inset-0 transition-transform duration-200 motion-reduce:transition-none ${zoomed && canZoom ? "scale-[2]" : "scale-100"}`}>
            <Image src={current?.url ?? fallback} alt={description} fill
              sizes="(min-width: 1024px) 1000px, 200vw" className="select-none object-contain" priority draggable={false} />
          </div>
        </button>
        {images.length > 1 && <>
          <button type="button" onClick={() => selectImage(selectedIndex - 1)} aria-label="Foto anterior"
            className="absolute top-1/2 left-3 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-tinta/10 bg-white/95 text-tinta shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button type="button" onClick={() => selectImage(selectedIndex + 1)} aria-label="Foto siguiente"
            className="absolute top-1/2 right-3 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-tinta/10 bg-white/95 text-tinta shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
          </button>
          <p aria-live="polite" aria-atomic="true" className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-tinta">
            Foto {selectedIndex + 1} de {images.length}
          </p>
        </>}
      </div>
      {canZoom && <p className="mt-2 text-xs text-tinta/60">Pasa el cursor o toca la imagen para ampliar.</p>}
      {images.length > 1 && (
        <div ref={thumbnailsRef} className="relative mt-3 flex gap-3 overflow-x-auto pb-2" aria-label="Elegir fotografía">
          {images.map((image, index) => (
            <button key={image.order} type="button" onClick={() => selectImage(index)}
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
