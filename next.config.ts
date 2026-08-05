import type { NextConfig } from "next";

// ============================================================================
// Headers de seguridad
// ============================================================================
// CSP calibrada al stack real:
//   - Nunito via next/font (self-hosted en /_next/static/media)
//   - Iframe de Google Maps embed en la seccion "Encuentranos"
//   - Widget de ePayco checkout on-page (checkout.epayco.co inyecta iframe
//     y hace requests a esos dominios cuando se abre la modal de pago)
//   - Proxy del catalogo (api.tiendasbigbang.com) — se llama desde el
//     server, no desde el navegador; connect-src lo permite igual por si
//     algun dia se cambia a fetch cliente.
//
// 'unsafe-inline' en script/style se mantiene porque:
//   - Next 16 con Turbopack inyecta inline scripts para hydration (no hay
//     nonce facil en app router server components).
//   - JSON-LD del producto es inline.
//   - Los estilos custom con CSS variables inline requeriren 'unsafe-inline'
//     en style-src.
// Mitigacion: la superficie XSS real esta acotada porque no aceptamos
// contenido de usuario que se pinte directo (todo pasa por React auto-escape).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.epayco.co https://checkout.epayco.co/*",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://api.tiendasbigbang.com https://*.supabase.co https://*.epayco.co",
  "frame-src 'self' https://maps.google.com https://www.google.com https://checkout.epayco.co https://*.epayco.co",
  "form-action 'self' https://checkout.epayco.co https://*.epayco.co",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    // 2 anios + subdominios + preload. Solo se envia sobre HTTPS: en dev
    // localhost es HTTP y el header simplemente no aplica (el navegador lo
    // ignora). En prod Vercel/Cloudflare ya sirve HTTPS.
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    // Duplica frame-ancestors 'none' para navegadores viejos que aun
    // interpretan XFO por encima de CSP.
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    // Denegamos permisos que el sitio no usa. Reduce superficie si algun
    // dia se cuela una libreria maliciosa.
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Content-Security-Policy",
    value: CSP,
  },
] as const;

const config: NextConfig = {
  reactStrictMode: true,
  // Quita el header "X-Powered-By: Next.js" — no aporta al usuario, si
  // aporta a un atacante para elegir exploits especificos del framework.
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "rzhzuvmrnfuctwyunhiu.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Los headers se aplican a TODAS las rutas del sitio (source: "/:path*").
  // Si en el futuro alguna ruta necesita una CSP mas relaxa (por ejemplo
  // /debug con eval), se agrega otra entrada con source mas especifico.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...SECURITY_HEADERS],
      },
    ];
  },
  // El warmup del cache del catalogo vive en instrumentation.ts.
  // Si algun dia lo desactivas, tambien deja el fetch al proxy con
  // timeout de 30s: el default de 10s no alcanza para el payload completo.
};

export default config;
