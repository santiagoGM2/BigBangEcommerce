import { SITE } from "./site";

/**
 * JSON-LD renderizado inline con <script type="application/ld+json"> para que
 * quede en el HTML servido y Google lo lea de una. No usar next/script con
 * afterInteractive: se cargaria en cliente y perderiamos el rich snippet.
 */

export function LocalBusinessJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: SITE.nombre,
    url: SITE.url,
    telephone: SITE.telefono,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${SITE.direccion.calle}, ${SITE.direccion.barrio}`,
      addressLocality: SITE.direccion.ciudad,
      addressRegion: SITE.direccion.departamento,
      addressCountry: SITE.direccion.codigoPais,
    },
    sameAs: [SITE.redes.instagram, SITE.redes.facebook, SITE.redes.tiktok],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
