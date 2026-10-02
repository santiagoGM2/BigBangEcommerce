import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { adminFetch } from "./product-images/remote";

config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Faltan credenciales de Supabase.");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: adminFetch() } });
const path = "drive/165-g6RpM5RhAsTx4Rr0IvZw-oNdwE-0n/66de5ab3c9ef8dbde14eec0f4e18a8c24df87f6397f97d25b278f024228542b6/034738-22.webp";
async function main() {
  const publicUrl = admin.storage.from("productos").getPublicUrl(path).data.publicUrl;
  const [source, gallery, principal] = await Promise.all([
    admin.from("producto_imagen_importaciones").select("source_key", { count: "exact", head: true }).eq("published_url", publicUrl),
    admin.from("producto_imagenes").select("id", { count: "exact", head: true }).eq("foto_url", publicUrl),
    admin.from("producto_extra").select("id_item", { count: "exact", head: true }).eq("foto_url", publicUrl),
  ]);
  for (const result of [source, gallery, principal]) {
    if (result.error) throw result.error;
    if (result.count !== 0) throw new Error("La imagen aun tiene una relacion; no se elimina de Storage.");
  }
  const { data, error } = await admin.storage.from("productos").remove([path]);
  if (error) throw error;
  console.log(JSON.stringify({ removed: data?.map(item => item.name) ?? [], requested: path }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
