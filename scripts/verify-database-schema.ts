import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

async function main() {
  // PostgreSQL aislado en memoria. No lee .env, no abre conexiones remotas.
  const db = new PGlite();
  try {
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;");
    const schema = await readFile("supabase/bootstrap/public-schema.sql", "utf8");
    await db.exec(schema);
    const tables = await db.query<{ tablename: string; rowsecurity: boolean }>("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'");
    assert.equal(tables.rows.length, 8);
    assert(tables.rows.every(table => table.rowsecurity), "Todas las tablas públicas tienen RLS");

    await db.exec("SET ROLE service_role");
    const numbers = await db.query<{ number: string }>("SELECT public.generate_numero_pedido() AS number FROM generate_series(1, 3)");
    assert.equal(new Set(numbers.rows.map(row => row.number)).size, 3);
    assert(numbers.rows.every(row => /^BB-\d{4}-\d{5}$/.test(row.number)), "Numeración real sin TypeScript");

    await db.query("SELECT public.register_product_image($1, $2, $3)", ["000002", "https://example.test/000002.webp", 1]);
    await db.query("SELECT public.register_product_image($1, $2, $3)", ["000002", "https://example.test/000002-new.webp", 1]);
    await db.query("SELECT public.register_product_image($1, $2, $3)", ["000002", "https://example.test/000002-1.webp", 2]);
    const images = await db.query<{ id_item: string; orden: number }>("SELECT id_item,orden FROM public.producto_imagenes ORDER BY orden");
    assert.deepEqual(images.rows, [{ id_item: "000002", orden: 1 }, { id_item: "000002", orden: 2 }]);
    const cover = await db.query<{ foto_url: string }>("SELECT foto_url FROM public.producto_extra WHERE id_item='000002'");
    assert.equal(cover.rows[0]?.foto_url, "https://example.test/000002-new.webp");
    await assert.rejects(db.query("INSERT INTO public.producto_imagenes(id_item,foto_url,orden) VALUES ('000002','https://example.test/a.webp',1)"), /unique|duplicate/i);
    await assert.rejects(db.query("INSERT INTO public.producto_imagenes(id_item,foto_url,orden) VALUES ('000002','https://example.test/a.webp',0)"), /check|constraint/i);
    await assert.rejects(db.query("INSERT INTO public.producto_imagenes(id_item,foto_url,orden) VALUES ('999999','https://example.test/a.webp',1)"), /foreign key/i);

    await db.query("INSERT INTO public.pedido(numero,comprador_nombre,comprador_email,comprador_telefono,envio_ciudad,envio_direccion,subtotal,total) VALUES ($1,'Cliente ficticio','fixture@example.test','3000000000','Cali','Dirección de prueba',4000,4000)", [numbers.rows[0]!.number]);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`RESET ROLE; SET ROLE ${role}`);
      assert.equal((await db.query("SELECT * FROM public.pedido")).rows.length, 0, "Pedidos privados incluso con permiso SELECT");
      assert.equal((await db.query("SELECT * FROM public.pedido_item")).rows.length, 0);
      assert.equal((await db.query("SELECT * FROM public.producto_imagenes")).rows.length, 2, "Fotos visibles públicas");
      await assert.rejects(db.query("SELECT public.generate_numero_pedido()"), /permission denied/i);
      await assert.rejects(db.query("SELECT public.register_product_image('000002','https://example.test/attack.webp',1)"), /permission denied/i);
      await assert.rejects(db.query("UPDATE public.producto_imagenes SET foto_url='https://example.test/attack.webp'"), /permission denied|row-level security/i);
    }
    await db.exec("RESET ROLE; SET ROLE service_role; UPDATE public.producto_extra SET visible=false WHERE id_item='000002'; RESET ROLE; SET ROLE anon;");
    assert.equal((await db.query("SELECT * FROM public.producto_imagenes")).rows.length, 0, "Fotos de producto oculto no se publican");
    await db.exec("RESET ROLE");
    await assert.rejects(db.exec(schema), /esquema public vacío/i);
    await db.exec("ROLLBACK");
    console.log("Esquema verificado: 8 tablas con RLS, numeración, permisos, privacidad de pedidos, FK, orden, unicidad e idempotencia de fotos; protección contra restauración sobre datos existentes.");
  } finally { await db.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
