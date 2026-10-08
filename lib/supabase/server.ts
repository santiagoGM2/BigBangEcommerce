import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Cliente server-only con la SERVICE ROLE KEY. Se usa exclusivamente para
 * escribir en tablas con RLS estricta que NO tienen policy publica (hoy:
 * pedido, pedido_item) y para llamar la funcion generate_numero_pedido().
 *
 * INVARIANTE:
 *   - Esta key JAMAS debe llegar al navegador.
 *   - Este archivo importa "server-only", asi que si alguien intenta
 *     usarlo desde un client component el build falla explicitamente.
 */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Variable de entorno faltante: ${name}. ` +
        `Requerida para escribir en pedido/pedido_item con service role.`,
    );
  }
  return v;
}

// Un solo cliente por proceso, reutilizado entre requests. Sin persistSession
// porque no hay usuario: siempre actuamos como service role.
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdmin() {
  if (cached) return cached;
  cached = createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false },
    },
  );
  return cached;
}
