import "server-only";

import { NextResponse } from "next/server";
import { getEpaycoConfig } from "@/lib/pagos/epayco";
import { createEpaycoOrderStore } from "@/lib/pagos/epayco-order-store";
import { fetchEpaycoTransaction, handleEpaycoWebhook } from "@/lib/pagos/epayco-webhook";
import { extraerIP, ratelimit } from "@/lib/seguridad/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// La firma SHA256 y el cliente administrativo solo se ejecutan en Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limit = ratelimit(extraerIP(request.headers), {
    name: "webhook-epayco", max: 60, windowMs: 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }
  const config = getEpaycoConfig();
  if (!config) {
    return NextResponse.json(
      { ok: false, error: "Payment gateway not configured" }, { status: 503 },
    );
  }
  return handleEpaycoWebhook(request, {
    config,
    store: createEpaycoOrderStore(getSupabaseAdmin()),
    lookupTransaction: fetchEpaycoTransaction,
  });
}

/** Comprobacion de disponibilidad sin consultar ni modificar pedidos. */
export function GET() {
  const config = getEpaycoConfig();
  return NextResponse.json({
    ok: true,
    configured: config !== null,
    testMode: config?.testMode ?? null,
  });
}
