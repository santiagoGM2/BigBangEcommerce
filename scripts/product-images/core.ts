import { readdir, readFile, lstat, mkdir, link, unlink, open } from "node:fs/promises";
import { resolve, relative, isAbsolute, dirname, extname } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { optimizeHeic } from "./heic";
import { classifyImageDecodeError, InvalidImageContentError } from "./image-validation";

export type ImageName = { idItem: string; order: number; storagePath: string };
export type Outcome = {
  file: string;
  status: "ready" | "success" | "invalidExtension" | "invalidName" | "duplicate" |
    "unknownId" | "catalogUnavailable" | "processingError" | "storageError" |
    "databaseError" | "moveError" | "blocked" | "unsupportedFormat" | "unknownFormat" | "journalError" | "invalidImage";
  format?: string;
  reassigned?: boolean;
  detail?: string;
  image?: ImageName;
  bytes?: number;
  width?: number;
  height?: number;
};

export function parseImageName(name: string): ImageName | null {
  const match = /^(\d+)(?:\s*\(([1-9]\d*)\)|-([1-9]\d*))?(?:\.(?:jpe?g|png|webp|heic))?$/i.exec(name);
  if (!match) return null;
  const suffix = Number(match[2] ?? match[3] ?? 0);
  if (!Number.isSafeInteger(suffix) || suffix >= 2147483647) return null;
  return { idItem: match[1]!, order: suffix + 1,
    storagePath: `${match[1]}${suffix ? `-${suffix}` : ""}.webp` };
}

export function catalogIds(rows: { id_item: string }[]): Set<string> {
  if (!rows.length || rows.some(row => typeof row.id_item !== "string" || !/^\d+$/.test(row.id_item))) {
    throw new Error("Catalogo vacio o id_item invalido: se cancela toda escritura.");
  }
  return new Set(rows.map(row => row.id_item));
}

// Compara cadenas: solo admite un alias sin ceros si identifica un unico ID
// real. Un ID exacto tiene prioridad; nunca se convierte a numero.
export function createIdResolver(ids: Set<string>) {
  const aliases = new Map<string, string | null>();
  for (const id of ids) {
    const alias = id.replace(/^0+(?=\d)/, "");
    aliases.set(alias, aliases.has(alias) ? null : id);
  }
  return (name: string): string | null => ids.has(name) ? name :
    aliases.get(name.replace(/^0+(?=\d)/, "")) ?? null;
}

export async function scanFiles(root: string): Promise<{ files: string[]; ignored: string[] }> {
  if ((await lstat(root)).isSymbolicLink()) throw new Error("La carpeta de originales no puede ser un enlace.");
  const files: string[] = [];
  const ignored: string[] = [];
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const fullPath = resolve(directory, entry.name);
      const name = relative(root, fullPath);
      if (entry.name.startsWith(".") || entry.name.toLowerCase() === "thumbs.db" ||
        entry.name.toLowerCase() === "procesadas" || entry.isSymbolicLink()) {
        ignored.push(name);
      } else if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile()) files.push(name);
      else ignored.push(name);
    }
  }
  await walk(root);
  return { files: files.sort(), ignored: ignored.sort() };
}

export function detectImageFormat(header: Buffer): string {
  if (header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpeg";
  if (header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (header.length >= 16 && header.toString("ascii", 4, 8) === "ftyp") {
    const brand = header.toString("ascii", 8, 12);
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) return "heic";
    if (["avif", "avis"].includes(brand)) return "avif";
    if (["mif1", "msf1"].includes(brand)) return "heif";
  }
  if (["GIF87a", "GIF89a"].includes(header.toString("ascii", 0, 6))) return "gif";
  return "unknown";
}

export async function detectFileFormats(root: string, files: string[]) {
  const formats = new Map<string, string>();
  await mapConcurrent(files, async file => {
    try {
      const handle = await open(resolve(root, file), "r");
      try {
        const header = Buffer.alloc(64);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        formats.set(file, detectImageFormat(header.subarray(0, bytesRead)));
      } finally { await handle.close(); }
    } catch { formats.set(file, "unreadable"); }
  });
  return formats;
}

export function planFiles(files: string[], ids: Set<string> | null, formats?: Map<string, string>): Outcome[] {
  const resolveId = ids ? createIdResolver(ids) : undefined;
  const result: Outcome[] = files.map(file => {
    const format = formats?.get(file);
    if (format === "unknown" || format === "unreadable") {
      return { file, format, status: "unknownFormat", detail: "Contenido desconocido o ilegible; no se autoriza la subida." };
    }
    if (format && !["jpeg", "png", "webp", "heic"].includes(format)) {
      return { file, format, status: "unsupportedFormat", detail: `Cabecera ${format.toUpperCase()}: fuera de los formatos permitidos; no implica archivo corrupto.` };
    }
    if (extname(file) && !/^\.(jpe?g|png|webp|heic)$/i.test(extname(file))) {
      return { file, format, status: "invalidExtension", detail: "Extension no permitida. Se admite ausencia de extension si el contenido es JPEG/PNG/WEBP/HEIC." };
    }
    const image = parseImageName(file.split(/[\\/]/).at(-1)!);
    if (!image) return { file, format, status: "invalidName", detail: "Se espera ID o ID (N), con extension opcional y N positivo." };
    if (resolveId) {
      const canonical = resolveId(image.idItem);
      if (!canonical) return { file, format, image, status: "unknownId", detail: `ID sin coincidencia unica en la vista actual: ${image.idItem}.` };
      image.idItem = canonical;
      image.storagePath = `${canonical}${image.order === 1 ? "" : `-${image.order - 1}`}.webp`;
    }
    return { file, format, image, status: ids ? "ready" : "catalogUnavailable" };
  });
  const paths = new Map<string, Outcome[]>();
  for (const row of result) {
    if (!row.image) continue;
    const group = paths.get(row.image.storagePath) ?? [];
    group.push(row);
    paths.set(row.image.storagePath, group);
  }
  for (const group of paths.values()) {
    if (group.length < 2) continue;
    for (const row of group.filter(row => ["ready", "catalogUnavailable"].includes(row.status))) {
      row.status = "duplicate";
      row.detail = `Destino duplicado ${row.image!.storagePath}: ${group.map(x => x.file).join(", ")}`;
    }
  }
  return result;
}

export async function mapConcurrent<T>(items: T[], work: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(5, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await work(item);
    }
  }));
}

// Archivo local completo: comprueba el formato real, orienta segun EXIF y
// elimina metadatos al convertir. Nunca escribe un temporal en dry-run.
export async function optimizeImage(path: string) {
  const source = await readFile(path);
  return optimizeImageBytes(source);
}

export async function optimizeImageBytes(source: Buffer) {
  if (detectImageFormat(source.subarray(0, 64)) === "heic") return optimizeHeic(source);
  try {
    const metadata = await sharp(source, { failOn: "warning" }).metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new InvalidImageContentError("Contenido no permitido aunque la extension sea valida.");
    if ((metadata.pages ?? 1) > 1) throw new InvalidImageContentError("Imagen animada o multipagina: requiere revision manual.");
    const output = await sharp(source, { failOn: "warning" }).rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    return { ...output, sourceFormat: metadata.format };
  } catch (error) {
    throw classifyImageDecodeError(error);
  }
}

function inside(root: string, path: string) {
  const rel = relative(root, path);
  if (!rel || rel === ".." || rel.startsWith(`..\\`) || rel.startsWith("../") || isAbsolute(rel)) {
    throw new Error("Ruta fuera del directorio permitido.");
  }
}

export async function archiveOriginal(root: string, file: string) {
  const source = resolve(root, file);
  const archiveRoot = resolve(root, "procesadas");
  const destination = resolve(archiveRoot, file);
  inside(root, source);
  inside(root, archiveRoot);
  inside(archiveRoot, destination);
  // Rechaza enlaces en los ancestros para no seguir un destino fuera de la raiz.
  const ancestors = new Set([root, archiveRoot]);
  for (const target of [source, destination]) {
    let current = dirname(target);
    while (current !== root) {
      inside(root, current);
      ancestors.add(current);
      current = dirname(current);
    }
  }
  if ((await lstat(source)).isSymbolicLink()) throw new Error("No se permiten originales enlazados.");
  for (const path of ancestors) {
    try { if ((await lstat(path)).isSymbolicLink()) throw new Error("No se permiten directorios enlazados."); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  await mkdir(dirname(destination), { recursive: true });
  let linkedPath = destination;
  try {
    // link falla con EEXIST: no sobrescribe un original previamente procesado.
    await link(source, destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    linkedPath = `${destination}.${randomUUID()}.original`;
    await link(source, linkedPath);
  }
  try { await unlink(source); }
  catch (error) {
    // Si no se completo el movimiento, intenta retirar solo el enlace nuevo.
    await unlink(linkedPath).catch(() => undefined);
    throw error;
  }
}

export interface ImportEffects {
  optimize(file: string): Promise<{ data: Buffer; info: { width: number; height: number }; sourceFormat?: string }>;
  upload(image: ImageName, data: Buffer): Promise<string>;
  relate(image: ImageName, url: string): Promise<void>;
  archive(file: string): Promise<void>;
  checkpoint?(row: Outcome, stage: "uploadAttempt" | "storageConfirmed" | "databaseConfirmed" | "archived", data: Buffer, url?: string): Promise<void>;
}

export async function processPlan(plan: Outcome[], effects: ImportEffects, options: {
  dryRun: boolean; canWrite: boolean; maxBytes: number;
}) {
  await mapConcurrent(plan, async row => {
    const diagnostic = options.dryRun && ["duplicate", "invalidName", "unknownId"].includes(row.status);
    if (row.status !== "ready" && row.status !== "catalogUnavailable" && !diagnostic) return;
    let output;
    try {
      output = await effects.optimize(row.file);
      row.bytes = output.data.length;
      row.width = output.info.width;
      row.height = output.info.height;
      row.format = output.sourceFormat ?? row.format;
      if (row.bytes > options.maxBytes) throw new Error(`WEBP excede el limite del bucket: ${row.bytes} bytes.`);
    } catch (error) {
      row.status = "processingError"; row.detail = errorMessage(error); return;
    }
    if (options.dryRun) return;
    if (!options.canWrite || row.status !== "ready") { row.status = "blocked"; return; }
    try { await effects.checkpoint?.(row, "uploadAttempt", output.data); }
    catch (error) { row.status = "journalError"; row.detail = errorMessage(error); return; }
    let url: string;
    try { url = await effects.upload(row.image!, output.data); }
    catch (error) { row.status = "storageError"; row.detail = errorMessage(error); return; }
    try { await effects.checkpoint?.(row, "storageConfirmed", output.data, url); }
    catch (error) { row.status = "journalError"; row.detail = errorMessage(error); return; }
    try { await effects.relate(row.image!, url); }
    catch (error) { row.status = "databaseError"; row.detail = errorMessage(error); return; }
    try { await effects.checkpoint?.(row, "databaseConfirmed", output.data, url); }
    catch (error) { row.status = "journalError"; row.detail = errorMessage(error); return; }
    try { await effects.archive(row.file); }
    catch (error) { row.status = "moveError"; row.detail = errorMessage(error); return; }
    try { await effects.checkpoint?.(row, "archived", output.data, url); }
    catch (error) { row.status = "journalError"; row.detail = `Original ya archivado con BD confirmada; fallo de diario: ${errorMessage(error)}`; return; }
    row.status = "success";
  });
}

export function errorMessage(error: unknown): string {
  // No serializar respuestas, headers ni clientes que puedan contener claves.
  if (!(error instanceof Error)) return "Operacion fallida";
  const cause = error.cause as { code?: unknown } | undefined;
  const code = typeof cause?.code === "string" && /^[A-Z0-9_]+$/.test(cause.code) ? ` (${cause.code})` : "";
  return `${error.message}${code}`;
}
