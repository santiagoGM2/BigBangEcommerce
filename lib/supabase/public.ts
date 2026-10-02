import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Cliente publico de Supabase — usa la anon key.
 * Solo lectura sobre tablas con RLS que permite acceso publico.
 * En este proyecto: producto_extra y producto_imagenes (productos visibles).
 *
 * NO usar este cliente para tocar pedido / pedido_item: no tienen policy
 * publica y ademas contienen datos personales. Para eso va el cliente server.
 */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variable de entorno faltante: ${name}`);
  return v;
}

let cached: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabasePublic() {
  if (cached) return cached;
  cached = createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: { persistSession: false },
    },
  );
  return cached;
}
