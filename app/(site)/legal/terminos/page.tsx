import type { Metadata } from "next";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { LegalDocument } from "@/components/legal/LegalDocument";

// Ruta publica de los Terminos y Condiciones de Venta. El contenido vive
// en _data/legal/terminos-y-condiciones.md (borrador pendiente de revision
// legal). Igual que privacidad, los [pendiente] se muestran sin tocar.

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description:
    "Términos y condiciones de venta de Piñatas y Regalos Big Bang. Envíos, pagos, cambios y devoluciones en Colombia.",
  alternates: { canonical: "/legal/terminos" },
};

const MD_PATH = "_data/legal/terminos-y-condiciones.md";

export default function TerminosPage() {
  const abs = join(process.cwd(), MD_PATH);
  const markdown = readFileSync(abs, "utf8");
  const mtime = statSync(abs).mtime;
  const fecha = mtime.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  });

  return <LegalDocument markdown={markdown} fechaActualizacion={fecha} />;
}
