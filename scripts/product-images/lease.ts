import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function acquireRemoteImportLease(admin: SupabaseClient) {
  const owner = randomUUID();
  const { data, error } = await admin.rpc("acquire_product_image_import_lock", { p_owner: owner });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Otra importacion tiene el bloqueo remoto; reintentar mas tarde.");
  return {
    owner,
    assert: async () => {
      const { error } = await admin.rpc("assert_product_image_import_lock", { p_owner: owner });
      if (error) throw new Error(error.message);
    },
    release: async () => {
      const { error } = await admin.rpc("release_product_image_import_lock", { p_owner: owner });
      if (error) throw new Error(error.message);
    },
  };
}
