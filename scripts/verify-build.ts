import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);
const nextCli = require.resolve("next/dist/bin/next");
const fixtureKey = "synthetic-verification-only-never-a-production-key";
const products = [
  { id_item: "000003", descripcion: "PRODUCTO SIN FOTO" },
  { id_item: "000002", descripcion: "PRODUCTO CON FOTOS" },
  { id_item: "000005", descripcion: "PRODUCTO OCULTO" },
].map(product => ({ ...product, referencia: product.id_item, categoria: "DISFRASES VARIOS", codigo_barra: product.id_item,
  precio: 4000, precio_fuente: "publica", existencias: null, activo: true }));

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("No se pudo abrir servidor local."));
      resolve(address.port);
    });
  });
}

function run(args: string[], env: NodeJS.ProcessEnv): ChildProcess {
  return spawn(process.execPath, [nextCli, ...args], { env, stdio: "inherit", windowsHide: true });
}

async function main() {
  let forbiddenRequests = 0;
  const fixture = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    if (request.method !== "GET") {
      forbiddenRequests++;
      response.writeHead(405).end(JSON.stringify({ message: "Verificación de solo lectura" }));
      return;
    }
    if (path === "/productos" && request.headers["x-api-key"] === fixtureKey) {
      response.end(JSON.stringify(products));
    } else if (path === "/rest/v1/producto_extra") {
      response.end(JSON.stringify([
        { id_item: "000002", foto_url: "/categorias/disfraces-y-halloween.png", visible: true },
        { id_item: "000005", foto_url: null, visible: false },
      ]));
    } else if (path === "/rest/v1/producto_imagenes") {
      response.end(JSON.stringify([1, 2].map(orden => ({ id_item: "000002", orden, foto_url: `/categorias/${orden === 1 ? "disfraces-y-halloween" : "juguetes"}.png` }))));
    } else {
      forbiddenRequests++;
      response.writeHead(404).end(JSON.stringify({ message: "Endpoint no permitido en esta verificación" }));
    }
  });
  let app: ChildProcess | undefined;
  try {
    const fixturePort = await listen(fixture);
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "production", BIGBANG_VERIFY_BUILD_DIR: "1", NEXT_TELEMETRY_DISABLED: "1",
      CATALOGO_API_BASE: `http://127.0.0.1:${fixturePort}`, CATALOGO_API_KEY: fixtureKey,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${fixturePort}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: fixtureKey,
      SUPABASE_SERVICE_ROLE_KEY: fixtureKey, ORDER_ACCESS_SECRET: fixtureKey,
      EPAYCO_PUBLIC_KEY: "", EPAYCO_PRIVATE_KEY: "", EPAYCO_P_CUST_ID: "", EPAYCO_TEST_MODE: "true",
      NEXT_PUBLIC_SITE_URL: "https://example.test",
    };
    // Las variables explícitas prevalecen sobre .env.local; jamás hay consultas reales.
    console.log("Build aislado con catálogo sintético; resultado en .next-verification.");
    const build = run(["build"], env);
    const code = await new Promise<number | null>((resolve, reject) => { build.once("error", reject); build.once("exit", resolve); });
    assert.equal(code, 0, "El build de producción debe completar");

    const reserve = createServer();
    const appPort = await listen(reserve);
    await new Promise<void>(resolve => reserve.close(() => resolve()));
    app = run(["start", "--hostname", "127.0.0.1", "--port", String(appPort)], env);
    const base = `http://127.0.0.1:${appPort}`;
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (app.exitCode !== null) throw new Error("El servidor terminó antes de estar listo.");
      try { ready = (await fetch(`${base}/robots.txt`, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* El servidor está arrancando. */ }
      if (ready) break;
      await delay(500);
    }
    assert(ready, "El servidor debe iniciar");
    const check = async (path: string, status: number) => {
      const response = await fetch(`${base}${path}`, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
      assert.equal(response.status, status, `${path}: estado HTTP`);
      return { response, body: await response.text() };
    };
    await check("/", 200);
    await check("/catalogo", 200);
    const category = await check("/catalogo/disfraces-y-halloween", 200);
    const withPhoto = category.body.indexOf("producto-con-fotos-000002");
    const withoutPhoto = category.body.indexOf("producto-sin-foto-000003");
    assert(withPhoto >= 0 && withoutPhoto >= 0, "Ambos productos presentes");
    assert(withPhoto < withoutPhoto, "Primero productos con foto");
    assert(!category.body.includes("producto-oculto-000005"), "Visibilidad privada respetada");
    await check("/catalogo/disfraces-y-halloween?page=1", 308);
    const product = await check("/producto/producto-con-fotos-000002", 200);
    assert(product.body.includes('application/ld+json'), "Datos estructurados presentes");
    assert(product.body.includes('000002'), "ID conserva ceros");
    assert(!product.response.headers.get("content-security-policy")?.includes("unsafe-eval"));
    await check("/producto/otro-nombre-000002", 308);
    await check("/producto/inexistente-999999", 404);
    await check("/producto/producto-oculto-000005", 404);
    await check("/catalogo/no-existe", 404);
    await check("/carrito", 200);
    await check("/checkout", 200);
    await check("/checkout/confirmacion?pedido=BB-2026-00001", 404);
    await check("/debug", 404);
    await check("/sitemap.xml", 200);
    const index = await check("/producto/sitemap.xml", 200);
    assert(index.body.includes("/producto/sitemap/0.xml"), "Índice enlaza fragmentos");
    const shard = await check("/producto/sitemap/0.xml", 200);
    assert(shard.body.includes("producto-con-fotos-000002"), "Sitemap contiene productos visibles");
    assert(!shard.body.includes("producto-oculto-000005"));
    assert.equal(forbiddenRequests, 0, "Ninguna escritura ni lectura de pedidos sin autorización");
    console.log("Verificación correcta: build y 17 rutas HTTP; catálogo, prioridad de fotos, IDs, redirecciones, privacidad y sitemaps.");
    if (process.argv.includes("--serve")) {
      console.log(`Servidor de pruebas disponible en ${base}; Ctrl+C para cerrar.`);
      await new Promise<void>(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
    }
  } finally {
    app?.kill();
    fixture.closeAllConnections();
    await new Promise<void>(resolve => fixture.close(() => resolve()));
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Falló la verificación."); process.exitCode = 1; });
