import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { LocalBusinessJsonLd } from "@/lib/seo/jsonld";
import { SITE } from "@/lib/seo/site";
import "./globals.css";

// Nunito con los pesos que usan los fragmentos de diseno. Incluye 900 porque
// casi todos los titulos, numeros de estadisticas y nombres de categoria del
// diseno original vienen en font-weight: 900. Sin italica: cta-mayorista.html
// la importa pero no la usa, y testimonios.html la neutraliza con
// font-style: normal en los <em>.
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.nombreCorto} · Piñatería, Jugueteria y Fiestas en Cali`,
    template: `%s | ${SITE.nombreCorto}`,
  },
  description:
    "Piñateria, jugueteria, disfraces y decoracion para fiestas en Cali. Envios en Cali y toda Colombia.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" className={nunito.variable}>
      <body>
        <LocalBusinessJsonLd />
        {children}
      </body>
    </html>
  );
}
