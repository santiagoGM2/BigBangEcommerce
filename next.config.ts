import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "rzhzuvmrnfuctwyunhiu.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // El warmup del cache del catalogo vive en instrumentation.ts.
  // Si algun dia lo desactivas, tambien deja el fetch al proxy con
  // timeout de 30s: el default de 10s no alcanza para el payload completo.
};

export default config;
