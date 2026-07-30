/**
 * Smoke test de la capa de catalogo. Se corre con: pnpm smoke:catalogo
 *
 * NO monta Next: llama getProductos() directo. Sirve para verificar que:
 *  - El fetch al proxy funciona y devuelve datos.
 *  - El cruce con Supabase (producto_extra) no falla.
 *  - Los filtros (OCULTAR + visible=false + categorias sin mapear) se
 *    aplican correctamente.
 *  - El breakdown por familia se acerca al esperado en el brief.
 *
 * Si alguna categoria del ERP no esta en familias.ts, aparece en el warning
 * de "categorias sin mapear" — esa es la senal de que hay que actualizar el
 * CSV y regenerar.
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// Cargamos .env.local igual que hace Next.js. Este script imita el runtime
// server-side sin arrancar el framework, entonces tenemos que hacerlo a mano.
loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

// Conteos de referencia del brief (con OCULTAR aplicado; total esperado 15.882).
const REFERENCIA = new Map<string, number>([
  ["juguetes", 3903],
  ["decoracion-fiestas", 3645],
  ["disfraces-y-halloween", 2333],
  ["dulceria-y-snacks", 1176],
  ["regalos-y-detalles", 1022],
  ["pinateria", 971],
  ["peluches", 968],
  ["escolar", 439],
  ["cosmeticos-y-cuidado-personal", 366],
  ["navidad", 330],
  ["moda-y-accesorios", 307],
  ["hogar-y-variedades", 216],
  ["tecnologia-y-electronica", 119],
  ["bebes", 87],
]);

async function main() {
  // Dynamic import DESPUES de haber cargado .env.local: sino el modulo
  // catalogo se importa sin las envs y throwea al llamar al proxy.
  const {
    getProductos,
    OCULTAR_CATEGORIAS_POR_CONFIRMAR,
    OCULTAR_RESPALDO_MAYORISTA,
  } = await import("../lib/catalogo/index.ts");
  const { FAMILIAS } = await import("../lib/catalogo/familias-meta.ts");

  console.log("\n=== SMOKE CATALOGO ===\n");
  console.log(
    `Flags: OCULTAR_RESPALDO_MAYORISTA=${OCULTAR_RESPALDO_MAYORISTA} · OCULTAR_CATEGORIAS_POR_CONFIRMAR=${OCULTAR_CATEGORIAS_POR_CONFIRMAR}\n`,
  );

  const t0 = Date.now();
  const productos = await getProductos();
  const ms = Date.now() - t0;

  console.log(`Productos publicables: ${productos.length}`);
  console.log(`Tiempo total (proxy + supabase + cruce): ${ms}ms\n`);

  // Breakdown por familia
  const porFamilia = new Map<string, number>();
  let conRespaldoMayorista = 0;
  let conFotoUrl = 0;
  let conStock = 0;
  let requiereConfirmacion = 0;

  for (const p of productos) {
    porFamilia.set(p.familia, (porFamilia.get(p.familia) ?? 0) + 1);
    if (p.precio_fuente === "respaldo_mayorista") conRespaldoMayorista++;
    if (p.foto_url) conFotoUrl++;
    if (p.existencias !== null) conStock++;
    if (p.requiere_confirmacion) requiereConfirmacion++;
  }

  console.log("Breakdown por familia (real vs referencia del brief):");
  const header = `  ${"familia".padEnd(34)} ${"real".padStart(6)}  ${"ref".padStart(6)}  delta`;
  console.log(header);
  console.log(`  ${"-".repeat(header.length - 2)}`);
  for (const f of FAMILIAS) {
    const real = porFamilia.get(f.slug) ?? 0;
    const ref = REFERENCIA.get(f.slug) ?? 0;
    const delta = real - ref;
    const flag = Math.abs(delta) > Math.max(5, ref * 0.02) ? " (!)" : "";
    console.log(
      `  ${f.slug.padEnd(34)} ${String(real).padStart(6)}  ${String(ref).padStart(6)}  ${String(delta).padStart(5)}${flag}`,
    );
  }

  console.log("");
  console.log(`Con precio_fuente = 'respaldo_mayorista': ${conRespaldoMayorista}`);
  console.log(`Con requiere_confirmacion=true:          ${requiereConfirmacion}`);
  console.log(`Con foto_url en Supabase:                ${conFotoUrl}`);
  console.log(`Con existencias != null:                 ${conStock}`);

  // Muestra un par de productos como sanity check
  console.log("\nEjemplos:");
  for (const p of productos.slice(0, 3)) {
    console.log(`  id_item="${p.id_item}"  familia=${p.familia}`);
    console.log(`    ${p.descripcion_mostrable}`);
    console.log(`    precio=${p.precio}  slug=/producto/${p.slug}`);
  }

  console.log("\n=== FIN SMOKE ===\n");
}

main().catch((err) => {
  console.error("\n[smoke] fallo:", err);
  process.exit(1);
});
