import type { Metadata } from "next";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { LegalDocument } from "@/components/legal/LegalDocument";

// Ruta publica de la Politica de Tratamiento de Datos. El contenido vive
// en _data/legal/politica-tratamiento-datos.md (borrador pendiente de
// revision legal). Los [pendiente] del texto se resaltan tal cual — NO
// se completan ni se borran (regla del propietario del documento).

export const metadata: Metadata = {
  title: "Política de Tratamiento de Datos",
  description:
    "Política de tratamiento de datos personales de Piñatas y Regalos Big Bang, conforme a la Ley 1581 de 2012 (Colombia).",
  alternates: { canonical: "/legal/privacidad" },
};

const MD_PATH = "_data/legal/politica-tratamiento-datos.md";

export default function PrivacidadPage() {
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
