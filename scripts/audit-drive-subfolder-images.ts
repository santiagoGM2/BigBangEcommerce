import "server-only";
import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createDriveFetch, driveFolderId, listDriveImages } from "./product-images/drive";
import type { DriveSource } from "./product-images/drive-publisher";
import { adminFetch } from "./product-images/remote";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });
const required = (key: string) => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Falta ${key}.`);
  return value;
};

async function main() {
  const admin = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: adminFetch() },
  });
  const fetcher = await createDriveFetch();
  const folderId = driveFolderId(required("GOOGLE_DRIVE_FOLDER_ID"));
  const files = await listDriveImages(fetcher, folderId, { includeSubfolders: true });
  const byId = new Map(files.map(file => [file.id, file]));
  const sources: DriveSource[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.from("producto_imagen_importaciones").select("*")
      .order("source_key").range(offset, offset + 999);
    if (error) throw new Error(error.message);
    sources.push(...data as DriveSource[]);
    if (data.length < 1000) break;
  }
  const nested = sources.flatMap(source => {
    const file = byId.get(source.source_key);
    return file?.relativePath.includes("/") ? [{ source_key: source.source_key,
      id_item: source.id_item, orden: source.orden, source_name: source.source_name,
      relative_path: file.relativePath, published_url: source.published_url }] : [];
  });
  const missing = sources.filter(source => !byId.has(source.source_key));
  console.log(`Drive: ${files.length} archivos; raiz: ${files.filter(file => !file.relativePath.includes("/")).length}; subcarpetas: ${files.filter(file => file.relativePath.includes("/")).length}`);
  console.log(`Fuentes en BD: ${sources.length}; publicadas desde subcarpetas: ${nested.filter(row => row.published_url).length}; sin localizar en Drive: ${missing.length}`);
  for (const row of nested) console.log(`SUBFOLDER_SOURCE ${JSON.stringify(row)}`);
  for (const source of missing) console.log(`UNLOCATED_SOURCE ${JSON.stringify({ source_key: source.source_key, id_item: source.id_item, orden: source.orden, source_name: source.source_name })}`);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
