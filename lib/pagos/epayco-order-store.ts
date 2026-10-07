import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import type { PaymentOrderStore } from "./epayco-webhook";

export function createEpaycoOrderStore(admin: SupabaseClient<Database>): PaymentOrderStore {
  return {
    async findByNumber(number) {
      const { data, error } = await admin.from("pedido")
        .select("id,numero,estado,total,referencia_pago,transaccion_id,updated_at")
        .eq("numero", number).maybeSingle();
      if (error) throw new Error("Order lookup failed");
      return data;
    },
    async compareAndSet(order, patch) {
      let query = admin.from("pedido").update(patch)
        .eq("id", order.id).eq("estado", order.estado).eq("total", order.total)
        .eq("updated_at", order.updated_at);
      query = order.referencia_pago === null
        ? query.is("referencia_pago", null) : query.eq("referencia_pago", order.referencia_pago);
      query = order.transaccion_id === null
        ? query.is("transaccion_id", null) : query.eq("transaccion_id", order.transaccion_id);
      const { data, error } = await query.select("id").maybeSingle();
      if (error) throw new Error("Order update failed");
      return data !== null;
    },
  };
}
