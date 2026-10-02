import "server-only";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { config } from "dotenv";
import { fetchPhotoCatalogIds } from "./product-images/catalog";
import { assignOrders } from "./product-images/assignments";
import { detectImageFormat, errorMessage, mapConcurrent, optimizeImageBytes, planFiles } from "./product-images/core";
import { createDriveFetch, downloadDriveImage, driveFolderId, listDriveImages } from "./product-images/drive";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

async function main() {
  if (process.argv.slice(2).some(arg => arg !== "--dry-run")) {
    throw new Error("Uso: pnpm fotos:drive --dry-run");
  }
  const folderId = driveFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID ?? "");
  const fetcher = await createDriveFetch();
  const files = await listDriveImages(fetcher, folderId);
  const images = files.filter(file => !file.name.startsWith(".") && file.name.toLowerCase() !== "thumbs.db");
  const skipped = files.length - images.length;
  let ids: Set<string> | null = null;
  let catalogIssue: string | undefined;
  try { ids = await fetchPhotoCatalogIds(); }
  catch (error) { catalogIssue = errorMessage(error); }

  const names = images.map(file => `${file.id}/${file.name}`);
  const formats = new Map<string, string>();
  const optimized = new Map<string, { bytes: number; width: number; height: number }>();
  const failures = new Map<string, string>();
  await mapConcurrent(images, async file => {
    const key = `${file.id}/${file.name}`;
    if (file.mimeType.startsWith("application/vnd.google-apps.")) {
      formats.set(key, "google-workspace");
      return;
    }
    try {
      const bytes = await downloadDriveImage(fetcher, file);
      if (file.md5Checksum && createHash("md5").update(bytes).digest("hex") !== file.md5Checksum) {
        throw new Error("Checksum MD5 de Drive no coincide con la descarga.");
      }
      formats.set(key, detectImageFormat(bytes.subarray(0, 64)));
      if (["jpeg", "png", "webp", "heic"].includes(formats.get(key)!)) {
        const result = await optimizeImageBytes(bytes);
        optimized.set(key, { bytes: result.data.length, width: result.info.width, height: result.info.height });
      }
    } catch (error) {
      formats.set(key, "unreadable");
      failures.set(key, errorMessage(error));
    }
  });

  const plan = planFiles(names, ids, formats);
  assignOrders(plan, [], [], ids !== null);
  for (const row of plan) {
    const result = optimized.get(row.file);
    if (result) Object.assign(row, result);
    if (failures.has(row.file)) { row.status = "processingError"; row.detail = failures.get(row.file); }
  }
  const count = (status: string) => plan.filter(row => row.status === status).length;
  console.log("=== DRIVE: DRY-RUN, SIN ESCRITURAS ===");
  console.log(`Carpeta: ${folderId}`);
  console.log(`Archivos encontrados: ${files.length}`);
  console.log(`Imagenes decodificadas y optimizadas: ${optimized.size}`);
  console.log(`Ignorados por nombre oculto: ${skipped}`);
  console.log(`IDs validados contra catalogo: ${ids ? new Set(plan.filter(row => row.image && ids!.has(row.image.idItem)).map(row => row.image!.idItem)).size : 0}`);
  console.log(`IDs realmente inexistentes: ${ids ? new Set(plan.filter(row => row.status === "unknownId").map(row => row.image!.idItem)).size : 0}`);
  console.log(`Pendientes de catalogo: ${count("catalogUnavailable")}`);
  console.log(`Imagenes listas: ${count("ready")}`);
  console.log(`Formatos no admitidos: ${count("unsupportedFormat")}`);
  console.log(`Contenido desconocido: ${count("unknownFormat")}`);
  console.log(`Nombres o extensiones invalidos: ${count("invalidName") + count("invalidExtension")}`);
  console.log(`Errores de descarga u optimizacion: ${count("processingError")}`);
  console.log(`Colisiones reasignadas sin descartar imagenes: ${plan.filter(row => row.reassigned).length}`);
  if (catalogIssue) console.log(`Catalogo pendiente: ${catalogIssue}`);
  for (let index = 0; index < plan.length; index++) {
    const row = plan[index]!;
    if (row.status === "ready") continue;
    const file = images[index]!;
    console.log(`[${row.status}] ${file.relativePath} (Drive ID ${file.id})${row.detail ? `: ${row.detail}` : ""}`);
  }
  console.log("No se subieron archivos, no se escribio en BD y no se movieron originales.");
  if (catalogIssue || plan.some(row => row.status !== "ready")) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`[FATAL] ${errorMessage(error)}`);
  process.exitCode = 1;
});
