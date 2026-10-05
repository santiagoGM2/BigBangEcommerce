import type { Outcome } from "./core";

export type DriveRunReportInput = {
  dryRun: boolean;
  catalogAvailable: boolean;
  found: number;
  ignored: number;
  optimized: number;
  unchanged: number;
  pendingAttempts: number;
  // El llamador debe redactar cualquier secreto de los detalles antes de entregarlos.
  rows: Outcome[];
};

export type DriveRunReport = {
  schemaVersion: 1;
  generatedAt: string;
  mode: "dry-run" | "publish";
  catalogAvailable: boolean;
  outcome: "success" | "completed_with_issues" | "failed";
  exitCode: 0 | 1;
  counts: {
    found: number;
    ignored: number;
    optimized: number;
    published: number;
    unchanged: number;
    unknownIdFiles: number;
    unknownIds: number;
    invalidImages: number;
    otherErrors: number;
    pendingAttempts: number;
  };
  rows: Outcome[];
};

const successfulStatuses = new Set<string>(["ready", "success"]);
const publicationStatuses = new Set<string>(["ready", "success", "unknownId", "invalidImage"]);

export function buildDriveRunReport(input: DriveRunReportInput): DriveRunReport {
  // Copia solamente los campos del informe; nunca serializa clientes, respuestas o entorno.
  const rows = input.rows.map((row): Outcome => ({
    file: row.file,
    status: row.status,
    ...(row.detail === undefined ? {} : { detail: row.detail }),
    ...(row.format === undefined ? {} : { format: row.format }),
    ...(row.reassigned === undefined ? {} : { reassigned: row.reassigned }),
    ...(row.bytes === undefined ? {} : { bytes: row.bytes }),
    ...(row.width === undefined ? {} : { width: row.width }),
    ...(row.height === undefined ? {} : { height: row.height }),
    ...(row.image === undefined ? {} : {
      image: { idItem: row.image.idItem, order: row.image.order, storagePath: row.image.storagePath },
    }),
  }));
  const unknownIdRows = rows.filter(row => row.status === "unknownId");
  const accepted = input.dryRun ? successfulStatuses : publicationStatuses;
  const failed = !input.catalogAvailable || input.pendingAttempts > 0 ||
    rows.some(row => !accepted.has(row.status));
  const hasIssues = rows.some(row => !successfulStatuses.has(row.status));
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: input.dryRun ? "dry-run" : "publish",
    catalogAvailable: input.catalogAvailable,
    outcome: failed ? "failed" : hasIssues ? "completed_with_issues" : "success",
    exitCode: failed ? 1 : 0,
    counts: {
      found: input.found,
      ignored: input.ignored,
      optimized: input.optimized,
      published: rows.filter(row => row.status === "success").length,
      unchanged: input.unchanged,
      unknownIdFiles: unknownIdRows.length,
      unknownIds: new Set(unknownIdRows.flatMap(row => row.image ? [row.image.idItem] : [])).size,
      invalidImages: rows.filter(row => row.status === "invalidImage").length,
      otherErrors: rows.filter(row => !publicationStatuses.has(row.status)).length,
      pendingAttempts: input.pendingAttempts,
    },
    rows,
  };
}

// Las entidades evitan que nombres provenientes de Drive creen HTML, enlaces o filas nuevas.
function escapeTableCell(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ")
    .replace(/[&<>`*_[\]{}()\\|!#~]/g, character => `&#${character.charCodeAt(0)};`);
}

function issueDescription(row: Outcome): string {
  if (row.status === "invalidImage") {
    return `Imagen rechazada: requiere reemplazo por una copia válida.${row.detail ? ` ${row.detail}` : ""}`;
  }
  if (row.status === "unknownId") {
    return `ID sin coincidencia única en la vista del ERP.${row.detail ? ` ${row.detail}` : ""}`;
  }
  return row.detail || "La operación no terminó correctamente; revisar el registro.";
}

export function renderDriveRunSummary(report: DriveRunReport): string {
  const title = report.outcome === "failed" ? "Falló la validación o la operación" :
    report.outcome === "completed_with_issues" ? "Completado con incidencias de archivos" : "Completado correctamente";
  const counts = report.counts;
  const lines = [
    `## Fotos de Drive: ${report.mode === "dry-run" ? "validación sin escrituras" : "publicación"}`,
    "",
    `**${title}.**`,
    "",
    `- Archivos encontrados: ${counts.found}`,
    `- Archivos ignorados: ${counts.ignored}`,
    `- Imágenes optimizadas: ${counts.optimized}`,
    `- Imágenes publicadas: ${counts.published}`,
    `- Ya publicadas, sin cambios: ${counts.unchanged}`,
    `- Archivos con ID sin coincidencia en la vista: ${counts.unknownIdFiles} (${counts.unknownIds} IDs)`,
    `- Imágenes rechazadas que requieren reemplazo: ${counts.invalidImages}`,
    `- Otros errores o bloqueos: ${counts.otherErrors}`,
    `- Intentos pendientes de conciliación: ${counts.pendingAttempts}`,
    "",
  ];
  if (!report.catalogAvailable) lines.push("**El catálogo no respondió correctamente: no se declaran IDs inexistentes.**", "");
  if (counts.pendingAttempts > 0) lines.push("**Existen intentos pendientes: revisar Storage y la relación en base de datos antes de dar la ejecución por terminada.**", "");
  if (report.mode === "dry-run" && report.outcome === "failed") {
    lines.push("La validación es estricta: una incidencia de archivo también produce resultado fallido.", "");
  }
  const issues = report.rows.filter(row => !successfulStatuses.has(row.status));
  if (issues.length) {
    lines.push("### Archivos pendientes de revisión", "", "| Archivo | ID | Estado | Motivo |", "| --- | --- | --- | --- |");
    for (const row of issues) {
      // La ruta incluye el ID de Drive como primer segmento; la tabla muestra el nombre original.
      const filename = row.file.includes("/") ? row.file.slice(row.file.indexOf("/") + 1) : row.file;
      lines.push(`| ${escapeTableCell(filename)} | ${escapeTableCell(row.image?.idItem ?? "—")} | ${escapeTableCell(row.status)} | ${escapeTableCell(issueDescription(row))} |`);
    }
    lines.push("");
  }
  lines.push("Los originales de Drive permanecen intactos. El informe JSON conserva el detalle por archivo.", "");
  return lines.join("\n");
}
