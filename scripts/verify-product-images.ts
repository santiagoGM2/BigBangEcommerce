import "server-only";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { mapConcurrent } from "./product-images/core";
import { adminFetch } from "./product-images/remote";

config({ path: ".env.local", quiet: true });
async function main() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Falta configuracion privada de Supabase.");
  const admin = createClient(base, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: adminFetch() } });
  const rows: { id_item: string; orden: number; foto_url: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.from("producto_imagenes").select("id_item,orden,foto_url")
      .order("id_item").order("orden").range(offset, offset + 999);
    if (error) throw new Error("No se pudo leer la galeria.");
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const errors: string[] = [];
  let verified = 0;
  const publicRead = adminFetch();
  await mapConcurrent(rows, async row => {
    try {
      const url = new URL(row.foto_url);
      if (url.origin !== new URL(base).origin || !url.pathname.startsWith("/storage/v1/object/public/productos/")) {
        throw new Error("URL fuera del bucket esperado");
      }
      const response = await publicRead(url, { method: "HEAD" });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("image/webp") || Number(response.headers.get("content-length")) <= 0) {
        throw new Error(`Objeto no confirmado: HTTP ${response.status}`);
      }
      verified++;
    } catch (error) {
      errors.push(`${row.id_item}, orden ${row.orden}: ${error instanceof Error ? error.message : "error de conexion"}`);
    }
  });
  console.log(`Relaciones: ${rows.length}; productos: ${new Set(rows.map(row => row.id_item)).size}; URLs WEBP publicas verificadas: ${verified}; errores: ${errors.length}`);
  errors.forEach(error => console.log(error));
  if (errors.length || !rows.length) process.exitCode = 1;
}
main().catch(() => { console.error("Verificacion fallida; no se imprimen credenciales."); process.exitCode = 1; });
