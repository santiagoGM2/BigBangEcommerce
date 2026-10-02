import "server-only";
import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { fetchPhotoCatalogIds } from "./product-images/catalog";
import {
  archiveOriginal, detectFileFormats, errorMessage, optimizeImage, planFiles, processPlan, scanFiles,
} from "./product-images/core";
import { acquireImportLock, createJournal, hashImage, pendingImports, reconciliationStatus } from "./product-images/journal";
import { adminFetch, remoteEffects } from "./product-images/remote";
import { assignOrders, loadAssignments, saveAssignments } from "./product-images/assignments";
import type { OccupiedSlot } from "./product-images/assignments";
import { acquireRemoteImportLease } from "./product-images/lease";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });
config({ path: resolve(process.cwd(), ".env"), quiet: true });

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--dry-run")) throw new Error("Uso: pnpm fotos [--dry-run]");
  const dryRun = args.includes("--dry-run");
  const root = resolve(process.cwd(), "_fotos-productos-pendientes");
  const { files, ignored } = await scanFiles(root);
  const release = dryRun ? undefined : await acquireImportLock(root);
  let remoteLease: Awaited<ReturnType<typeof acquireRemoteImportLease>> | undefined;
  try {
  const issues: string[] = [];
  const safeMessage = (error: unknown) => {
    let message = errorMessage(error);
    for (const key of [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.CATALOGO_API_KEY]) {
      if (key) message = message.replaceAll(key, "[REDACTADO]");
    }
    return message;
  };
  console.log(`\n=== FOTOS: ${dryRun ? "DRY-RUN (sin escrituras)" : "CARGA REAL"} ===`);
  let ids: Set<string> | null = null;
  // Misma vista real del ERP; consulta independiente de precios y filtros de
  // publicacion. Un producto oculto sigue existiendo en el ERP.
  try {
    ids = await fetchPhotoCatalogIds();
    console.log(`IDs del catalogo real: ${ids.size}`);
  } catch (error) {
    issues.push(`Catalogo no disponible: ${safeMessage(error)}. No se autoriza ninguna subida.`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  // Exclusivo del CLI. No usar la anon key ni importar este modulo en la UI.
  // El tipo futuro no se agrega a database.types.ts hasta aplicar la migracion.
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: adminFetch() },
  });
  if (!dryRun && ids) remoteLease = await acquireRemoteImportLease(admin);
  let bucketReady = false;
  let schemaReady = false;
  let maxBytes = 5 * 1024 * 1024;
  try {
    const { data, error } = await admin.storage.getBucket("productos");
    if (error) throw new Error(error.message);
    if (!data.public) throw new Error("El bucket productos debe ser publico para almacenar URLs permanentes publicas.");
    if (data.allowed_mime_types && !data.allowed_mime_types.some(type => ["image/webp", "image/*", "*/*"].includes(type))) {
      throw new Error("El bucket no acepta image/webp.");
    }
    maxBytes = data.file_size_limit ? Number(data.file_size_limit) : Infinity;
    bucketReady = true;
    console.log(`Bucket productos: publico, limite ${maxBytes} bytes, WEBP permitido.`);
  } catch (error) { issues.push(`Prevalidacion Storage: ${safeMessage(error)}`); }
  try {
    const { error } = await admin.from("producto_imagenes")
      .select("id,id_item,foto_url,orden,created_at,updated_at").limit(0);
    if (error) throw new Error(error.message);
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Inspeccion de RPC: HTTP ${response.status}`);
    const api = await response.json() as { paths?: Record<string, unknown> };
    if (!api.paths?.["/rpc/register_product_image"]) throw new Error("Falta RPC register_product_image.");
    schemaReady = true;
  } catch (error) {
    issues.push(`Prevalidacion BD: ${safeMessage(error)}. Revisar supabase/migrations/20261001214710_product_images.sql antes de la carga real.`);
  }

  // Solo lecturas: detectar intentos incompletos incluso si ya no esta el original.
  let journalReady = true;
  try {
    for (const entry of await pendingImports(root)) {
      const { data: blob, error: storageError } = await admin.storage.from("productos").download(entry.storagePath);
      const { data: relation, error: dbError } = await admin.from("producto_imagenes")
        .select("foto_url").eq("id_item", entry.idItem).eq("orden", entry.order).maybeSingle();
      const objectMissing = storageError && /not found/i.test(storageError.message);
      if ((storageError && !objectMissing) || dbError) {
        issues.push(`Intento pendiente ${entry.file}: no se pudo reconciliar Storage/BD; revisar diario local.`);
        journalReady = false;
      } else {
        const expectedUrl = admin.storage.from("productos").getPublicUrl(entry.storagePath).data.publicUrl;
        const diagnosis = reconciliationStatus(entry, blob ? Buffer.from(await blob.arrayBuffer()) : null, relation?.foto_url ?? null, expectedUrl);
        console.log(`[RECONCILIACION] ${entry.file}: ${diagnosis}`);
        // Permite recuperar solo cuando se vuelve a presentar el mismo original.
        if (!files.includes(entry.file)) { issues.push(`Intento pendiente sin original: ${entry.file}`); journalReady = false; }
        else if (hashImage((await optimizeImage(resolve(root, entry.file))).data) !== entry.sha256 || diagnosis.startsWith("Objeto con contenido distinto")) {
          issues.push(`Intento pendiente con contenido cambiado: ${entry.file}. Revisar antes de reemplazar.`); journalReady = false;
        }
      }
    }
  } catch (error) { issues.push(`Diario local: ${safeMessage(error)}`); journalReady = false; }

  const formats = await detectFileFormats(root, files);
  const plan = planFiles(files, ids, formats);
  let assignmentsReady = true;
  let assignments: Awaited<ReturnType<typeof loadAssignments>> = [];
  try {
    const previous = await loadAssignments(root, url);
    const occupied: OccupiedSlot[] = [];
    if (schemaReady) {
      const relevantIds = [...new Set(plan.flatMap(row => row.image ? [row.image.idItem] : []))];
      for (let start = 0; start < relevantIds.length; start += 100) {
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await admin.from("producto_imagen_importaciones").select("id_item,orden")
            .in("id_item", relevantIds.slice(start, start + 100)).order("source_key").range(offset, offset + 999);
          if (error) throw new Error(error.message);
          occupied.push(...data as OccupiedSlot[]);
          if (data.length < 1000) break;
        }
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await admin.from("producto_imagenes").select("id_item,orden")
            .in("id_item", relevantIds.slice(start, start + 100)).order("id").range(offset, offset + 999);
          if (error) throw new Error(error.message);
          occupied.push(...data as OccupiedSlot[]);
          if (data.length < 1000) break;
        }
      }
    }
    assignments = assignOrders(plan, previous, occupied, ids !== null);
  } catch (error) { assignmentsReady = false; issues.push(`Asignaciones: ${safeMessage(error)}`); }
  const valid = plan.filter(row => row.status === "ready").length;
  const canWrite = ids !== null && bucketReady && schemaReady && journalReady && assignmentsReady;
  if (!dryRun && !canWrite) {
    for (const row of plan) if (row.status === "ready" || row.status === "catalogUnavailable") row.status = "blocked";
  } else {
    // Se persiste el lote entero ANTES de Storage. Un reintento con solo los
    // originales restantes conserva sus posiciones, aunque falten otros archivos.
    if (!dryRun) await saveAssignments(root, url, assignments);
    const effects = remoteEffects(admin);
    await processPlan(plan, {
      optimize: file => optimizeImage(resolve(root, file)),
      upload: async (image, data) => { await remoteLease?.assert(); return effects.upload(image, data); },
      relate: async (image, publicUrl) => { await remoteLease?.assert(); return effects.relate(image, publicUrl); },
      archive: file => archiveOriginal(root, file),
      checkpoint: createJournal(root),
    }, { dryRun, canWrite, maxBytes });
  }
  const count = (status: string) => plan.filter(row => row.status === status).length;
  const candidateIds = new Set(plan.flatMap(row => row.image ? [row.image.idItem] : []));
  console.log("\n=== RESUMEN ===");
  const summary = {
    "Total encontrados": files.length,
    "Formatos detectados": Object.fromEntries([...new Set(formats.values())].map(format => [format, [...formats.values()].filter(value => value === format).length])),
    "Imagenes validas (decodificadas)": plan.filter(row => row.bytes !== undefined && row.status !== "processingError").length,
    "IDs distintos interpretables": candidateIds.size,
    "IDs distintos validados": ids ? [...candidateIds].filter(id => ids.has(id)).length : 0,
    "IDs distintos realmente inexistentes": ids ? [...candidateIds].filter(id => !ids.has(id)).length : 0,
    "IDs distintos pendientes de catalogo": ids ? 0 : candidateIds.size,
    "Validos (extension, nombre, ID y destino unico)": valid,
    "Optimizados": plan.filter(row => row.bytes !== undefined && row.status !== "processingError").length,
    "Subidos correctamente (relacion confirmada)": count("success") + count("moveError"),
    "Archivos con ID no encontrado": count("unknownId"),
    "Extensiones invalidas": count("invalidExtension"),
    "Formatos no admitidos (no implica corrupcion)": count("unsupportedFormat"),
    "Contenido desconocido o ilegible": count("unknownFormat"),
    "Nombres invalidos": count("invalidName"),
    "Destinos duplicados": count("duplicate"),
    "Imagenes adicionales reasignadas sin perder originales": plan.filter(row => row.reassigned).length,
    "Errores de procesamiento": count("processingError"),
    "Errores de Storage": count("storageError"),
    "Errores de base de datos": count("databaseError"),
    "Errores al mover": count("moveError"),
    "Errores de diario": count("journalError"),
    "Sin validar contra catalogo": count("catalogUnavailable"),
    "Bloqueados": count("blocked"),
    "Ignorados (ocultos/procesadas/enlaces)": ignored.length,
    "Problemas de prevalidacion": issues.length,
  };
  for (const [label, value] of Object.entries(summary)) console.log(`${label}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
  for (const issue of issues) console.log(`[PREVALIDACION] ${issue}`);
  for (const file of ignored) console.log(`[IGNORADO] ${file}`);
  console.log("\n=== DETALLE COMPLETO ===");
  for (const row of plan) {
    const target = row.image ? ` -> ${row.image.storagePath}, ID=${row.image.idItem}, orden=${row.image.order}` : "";
    const optimized = row.bytes === undefined ? "" : `, ${row.width}x${row.height}, ${row.bytes} bytes`;
    console.log(`[${row.status}] ${row.file} [formato=${row.format ?? "sin detectar"}]${target}${optimized}${row.detail ? `: ${safeMessage(new Error(row.detail))}` : ""}`);
  }
  if (dryRun) console.log("\nNo se subieron archivos, no se escribio en BD y no se movieron originales.");
  if (issues.length || plan.some(row => !["ready", "success"].includes(row.status))) process.exitCode = 1;
  } finally { try { await remoteLease?.release(); } finally { await release?.(); } }
}

main().catch(error => {
  // Los errores globales no serializan objetos de red ni credenciales.
  console.error(`[FATAL] ${errorMessage(error)}`);
  process.exitCode = 1;
});
