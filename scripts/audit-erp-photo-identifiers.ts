import { readFile, writeFile } from "node:fs/promises";
import { scanFiles, parseImageName } from "./product-images/core";

// Auditoria de una lectura real guardada localmente; no sustituye el proxy,
// no inventa productos y no habilita subidas con esta captura.
async function main() {
  const rows = JSON.parse((await readFile(".erp-audit/catalog-raw.json", "utf8")).replace(/^\uFEFF/, "")) as { ID_ITEM: string }[];
  if (!rows.length || rows.some(row => typeof row.ID_ITEM !== "string" || !/^\d+$/.test(row.ID_ITEM))) {
    throw new Error("Captura incompleta o IDs invalidos.");
  }
  const ids = new Set(rows.map(row => row.ID_ITEM));
  const withoutZeros = (id: string) => id.replace(/^0+(?=\d)/, "");
  const aliases = new Map<string, string[]>();
  for (const id of ids) aliases.set(withoutZeros(id), [...(aliases.get(withoutZeros(id)) ?? []), id]);
  const { files } = await scanFiles("_fotos-productos-pendientes");
  const audit = files.map(file => {
    const image = parseImageName(file);
    const matches = image ? ids.has(image.idItem) ? [image.idItem] : aliases.get(withoutZeros(image.idItem)) ?? [] : [];
    return { file, namedId: image?.idItem, matches };
  });
  const matched = audit.filter(row => row.matches.length === 1);
  const missing = audit.filter(row => row.matches.length === 0);
  const summary = { rows: rows.length, catalogIds: ids.size, totalFiles: files.length,
    exactMatches: audit.filter(row => row.namedId && ids.has(row.namedId)).length,
    uniqueMatchesIgnoringInitialZeros: matched.length,
    matchedProductIds: new Set(matched.map(row => row.matches[0])).size,
    filesWithoutMatch: missing.length, idsWithoutMatch: new Set(missing.map(row => row.namedId)).size,
    ambiguous: audit.filter(row => row.matches.length > 1).length };
  const report = "# Auditoria de IDs contra la vista — 2026-10-01\n\n" +
    "Lectura real completa desde el Droplet. Sin escrituras ni subidas. La coincidencia\n" +
    "por ceros usa strings y exige un unico ID real; no cambia aun el importador.\n\n" +
    "```json\n" + JSON.stringify(summary, null, 2) + "\n```\n\n" +
    "## Archivos sin coincidencia en la vista actual\n\n" + missing.map(row => `- ${row.file}`).join("\n") +
    "\n\nNo demuestra que el producto no exista en otras tablas del ERP. Requiere revisar\n" +
    "el identificador y si el producto se incluye en esta vista.\n\n" +
    "## Cruces encontrados\n\n| Archivo | ID real |\n| --- | --- |\n" +
    matched.map(row => `| ${row.file} | ${row.matches[0]} |`).join("\n") + "\n";
  await writeFile("docs/erp-photo-identifiers-20261001.md", report);
  console.log(JSON.stringify(summary, null, 2));
}
main().catch(() => { console.error("La auditoria de IDs fallo; no se usa un listado parcial."); process.exitCode = 1; });
