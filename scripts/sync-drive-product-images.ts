import "server-only";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchPhotoCatalogIds } from "./product-images/catalog";
import { assignOrders } from "./product-images/assignments";
import { createIdResolver, detectImageFormat, errorMessage, mapConcurrent, optimizeImageBytes, planFiles } from "./product-images/core";
import { createDriveFetch, downloadDriveImage, driveFolderId, listDriveImages } from "./product-images/drive";
import { publishDriveImage, type DriveAttempt, type DriveSource } from "./product-images/drive-publisher";
import { acquireRemoteImportLease } from "./product-images/lease";
import { adminFetch } from "./product-images/remote";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });
const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name}.`);
  return value;
};
async function readRows<T>(admin: SupabaseClient, table: string, orders: string[]): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = admin.from(table).select("*");
    for (const order of orders) query = query.order(order);
    const { data, error } = await query.range(offset, offset + 999);
    if (error) throw new Error(error.message);
    rows.push(...data as T[]);
    if (data.length < 1000) return rows;
  }
}
const single = <T,>(value: T | T[]): T => Array.isArray(value) ? value[0]! : value;

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => !["--dry-run", "--publish"].includes(arg))) {
    throw new Error("Uso: pnpm fotos:drive:sync --dry-run | --publish");
  }
  const dryRun = !args.includes("--publish");
  console.log(`=== DRIVE: ${dryRun ? "DRY-RUN" : "PUBLICACION"} ===`);
  let ids: Set<string> | null = null;
  try { ids = await fetchPhotoCatalogIds(); }
  catch (error) {
    console.log(`[PREVALIDACION] Catalogo no disponible: ${errorMessage(error)}. Ningun ID se declara inexistente.`);
    if (!dryRun) throw new Error("Carga detenida antes de Drive, Storage y BD: falta validar el catalogo real.");
  }
  const admin = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: adminFetch() },
  });
  const { data: bucket, error: bucketError } = await admin.storage.getBucket("productos");
  if (bucketError || !bucket?.public || (bucket.allowed_mime_types &&
    !bucket.allowed_mime_types.some(type => ["image/webp", "image/*", "*/*"].includes(type)))) {
    throw new Error("El bucket productos no esta disponible como publico con WEBP permitido.");
  }
  const maxBytes = bucket.file_size_limit ? Number(bucket.file_size_limit) : Infinity;
  const lease = dryRun ? undefined : await acquireRemoteImportLease(admin);
  let temporary: string | undefined;
  try {
    temporary = await mkdtemp(resolve(tmpdir(), "bigbang-drive-images-"));
    const [sources, occupied] = await Promise.all([
      readRows<DriveSource>(admin, "producto_imagen_importaciones", ["source_key"]),
      readRows<{ id_item: string; orden: number }>(admin, "producto_imagenes", ["id"]),
    ]);
    const bySource = new Map(sources.map(source => [source.source_key, source]));
    const resolveId = ids ? createIdResolver(ids) : undefined;
    const fetcher = await createDriveFetch();
    const files = await listDriveImages(fetcher, driveFolderId(required("GOOGLE_DRIVE_FOLDER_ID")));
    const candidates = files.filter(file => !file.name.startsWith(".") && file.name.toLowerCase() !== "thumbs.db");
    const keyFor = (file: { id: string; name: string }) => `${file.id}/${file.name}`;
    const plan = planFiles(candidates.map(keyFor), ids);
    const previous = candidates.flatMap(file => {
      const source = bySource.get(file.id);
      return source ? [{ file: keyFor(file), idItem: source.id_item, order: source.orden,
        storagePath: `${source.id_item}${source.orden === 1 ? "" : `-${source.orden - 1}`}.webp` }] : [];
    });
    assignOrders(plan, previous, [...occupied, ...sources], ids !== null);
    const unchanged = new Set<string>();
    // No acumula el inventario completo en RAM; solo cinco trabajos simultaneos.
    const outputs = new Map<string, string>();
    await mapConcurrent(candidates.map((file, index) => ({ file, row: plan[index]! })), async ({ file, row }) => {
      if (/[\\/]/.test(file.name)) { row.status = "invalidName"; return; }
      const source = bySource.get(file.id);
      // Nunca reasigna silenciosamente un archivo renombrado a otro producto.
      const rawId = planFiles([file.name], null)[0]?.image?.idItem;
      const namedId = rawId && resolveId ? resolveId(rawId) : rawId;
      if (source && namedId !== source.id_item) {
        row.status = "blocked"; row.detail = "El archivo se renombro a otro ID; requiere revision."; return;
      }
      if (!["ready", "catalogUnavailable", "unknownId"].includes(row.status)) return;
      if (!file.version || !file.md5Checksum) {
        row.status = "blocked"; row.detail = "Drive no entrego version y checksum; no se publica."; return;
      }
      if (!dryRun && row.status !== "ready") return;
      if (!dryRun && source?.published_version === file.version && source.published_url) {
        unchanged.add(row.file); return;
      }
      try {
        const bytes = await downloadDriveImage(fetcher, file);
        if (createHash("md5").update(bytes).digest("hex") !== file.md5Checksum) throw new Error("Archivo cambio durante la descarga o checksum incorrecto.");
        row.format = detectImageFormat(bytes.subarray(0, 64));
        const result = await optimizeImageBytes(bytes);
        row.bytes = result.data.length; row.width = result.info.width; row.height = result.info.height;
        if (row.bytes > maxBytes) throw new Error("WEBP supera el limite del bucket.");
        const output = resolve(temporary!, `${file.id}.webp`);
        await writeFile(output, result.data);
        outputs.set(row.file, output);
      } catch (error) { row.status = "processingError"; row.detail = errorMessage(error); }
    });
    const ready = candidates.filter((file, index) => plan[index]!.status === "ready" && outputs.has(keyFor(file)));
    if (!dryRun && ready.length) {
      const reserved = new Map<string, DriveSource>();
      // Reserva el lote completo antes de Storage para conservar colisiones en reintentos parciales.
      for (let start = 0; start < ready.length; start += 500) {
        const payload = ready.slice(start, start + 500).map(file => {
          const row = plan.find(row => row.file === keyFor(file))!;
          return { source_key: file.id, source_name: file.name, source_version: file.version,
            id_item: row.image!.idItem, orden: row.image!.order };
        });
        const { data, error } = await admin.rpc("reserve_drive_product_images", { p_owner: lease!.owner, p_files: payload });
        if (error) throw new Error(error.message);
        for (const source of data as DriveSource[]) reserved.set(source.source_key, source);
      }
      await mapConcurrent(ready, async file => {
        const row = plan.find(row => row.file === keyFor(file))!;
        const source = reserved.get(file.id);
        if (!source || source.id_item !== row.image!.idItem || source.observed_version !== file.version) {
          row.status = "databaseError"; row.detail = "Reserva no confirmada"; return;
        }
        row.image!.order = source.orden;
        let bytes: Buffer | undefined;
        try {
          bytes = await readFile(outputs.get(row.file)!);
          await publishDriveImage(source, bytes, {
            assertLease: () => lease!.assert(),
            prepare: async (source, sha, path) => {
              const { data, error } = await admin.rpc("prepare_drive_product_image", {
                p_owner: lease!.owner, p_source_key: source.source_key, p_version: source.observed_version,
                p_sha256: sha, p_storage_path: path,
              });
              if (error) throw new Error(`Diario BD: ${error.message}`);
              return single(data as DriveAttempt | DriveAttempt[]);
            },
            upload: async (path, data) => {
              const { error } = await admin.storage.from("productos").upload(path, data,
                { contentType: "image/webp", cacheControl: "31536000", upsert: true });
              if (error) throw new Error(`Storage: ${error.message}`);
              return admin.storage.from("productos").getPublicUrl(path).data.publicUrl;
            },
            confirmUpload: async (source, sha) => {
              const { error } = await admin.rpc("confirm_drive_image_upload", {
                p_owner: lease!.owner,p_source_key: source.source_key,p_version: source.observed_version,p_sha256: sha,
              });
              if (error) throw new Error(`BD tras Storage: ${error.message}`);
            },
            complete: async (source, sha, url) => {
              const { data, error } = await admin.rpc("complete_drive_product_image", {
                p_owner: lease!.owner,p_source_key: source.source_key,p_version: source.observed_version,p_sha256: sha,p_foto_url: url,
              });
              if (error) throw new Error(`BD publicacion: ${error.message}`);
              return single(data as DriveSource | DriveSource[]);
            },
          });
          row.status = "success";
        } catch (error) {
          row.status = errorMessage(error).startsWith("Storage:") ? "storageError" : "databaseError";
          row.detail = errorMessage(error);
          const { error: journalError } = bytes ? await admin.from("producto_imagen_intentos")
            .update({ last_error: row.detail.slice(0, 1000), updated_at: new Date().toISOString() })
            .eq("source_key", file.id).eq("source_version", file.version!)
            .eq("sha256", createHash("sha256").update(bytes).digest("hex")).is("completed_at", null) : { error: null };
          if (journalError) row.detail += "; fallo de reporte BD: revisar intento pendiente";
        }
      });
    }
    console.log(`Archivos encontrados: ${files.length}; ignorados: ${files.length-candidates.length}`);
    console.log(`Optimizados: ${outputs.size}; publicados: ${plan.filter(row => row.status === "success").length}; sin cambios: ${unchanged.size}`);
    console.log(`IDs validados: ${ids ? new Set(plan.filter(row => row.image && ids!.has(row.image.idItem)).map(row => row.image!.idItem)).size : 0}`);
    console.log(`IDs sin coincidencia unica en la vista actual: ${ids ? new Set(plan.filter(row => row.status === "unknownId").map(row => row.image!.idItem)).size : 0}`);
    const attempts = await readRows<DriveAttempt>(admin, "producto_imagen_intentos", ["source_key", "source_version", "sha256"]);
    for (const attempt of attempts.filter(attempt => !attempt.completed_at)) {
      console.log(`[INTENTO PENDIENTE] ${attempt.source_key}: ${attempt.storage_path}. Puede contener un objeto sin relacion; se conserva para conciliacion.`);
    }
    for (const row of plan) console.log(`[${unchanged.has(row.file) ? "sin cambios" : row.status}] ${JSON.stringify(row.file)}${row.image ? ` ID=${row.image.idItem}, orden=${row.image.order}` : ""}${row.detail ? `: ${row.detail}` : ""}`);
    console.log("Los originales de Drive permanecen intactos.");
    if (!ids || plan.some(row => !["ready", "success"].includes(row.status))) process.exitCode = 1;
  } finally {
    try { await lease?.release(); }
    finally { if (temporary) await rm(temporary, { recursive: true, force: true }); }
  }
}

main().catch((error: unknown) => {
  let message = errorMessage(error);
  for (const secret of [process.env.CATALOGO_API_KEY,process.env.SUPABASE_SERVICE_ROLE_KEY]) {
    if (secret) message = message.replaceAll(secret, "[REDACTADO]");
  }
  console.error(`[FATAL] ${message}`); process.exitCode = 1;
});
