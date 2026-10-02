import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportEffects } from "./core";

export function adminFetch(fetcher: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const attempts = ["GET", "HEAD"].includes(method) ? 2 : 1;
    for (let attempt = 0; ; attempt++) {
      try { return await fetcher(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(30_000) }); }
      catch (error) {
        // Solo reintenta una lectura con fallo de transporte. Una escritura
        // incierta nunca se repite aqui: queda registrada en el diario.
        if (!(error instanceof TypeError) || attempt + 1 >= attempts || init?.signal?.aborted) throw error;
      }
    }
  };
}

export function remoteEffects(admin: SupabaseClient): Pick<ImportEffects, "upload" | "relate"> {
  return {
    upload: async (image, data) => {
      const { error } = await admin.storage.from("productos").upload(image.storagePath, data, {
        contentType: "image/webp", cacheControl: "3600", upsert: true,
      });
      if (error) throw new Error(error.message);
      return admin.storage.from("productos").getPublicUrl(image.storagePath).data.publicUrl;
    },
    relate: async (image, publicUrl) => {
      const { data, error } = await admin.rpc("register_product_image", {
        p_id_item: image.idItem, p_foto_url: publicUrl, p_orden: image.order,
      });
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.id_item !== image.idItem || row?.orden !== image.order || row?.foto_url !== publicUrl) {
        throw new Error("La RPC no confirmo la relacion esperada; se conserva el original.");
      }
    },
  };
}
