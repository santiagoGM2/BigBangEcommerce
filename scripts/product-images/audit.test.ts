import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { detectFileFormats, optimizeImage, planFiles, processPlan } from "./core";
import { acquireImportLock, createJournal, pendingImports, reconciliationStatus } from "./journal";
import { adminFetch, remoteEffects } from "./remote";
import { assignOrders } from "./assignments";

test("JPEG/PNG/WEBP sin extension: contenido real, no renombra; HEIC truncado se rechaza", async () => {
  const root = await mkdtemp(join(tmpdir(), "bb-fotos-content-"));
  try {
    const files = ["000480", "000480 (1)", "000480 (2)", "000481", "000482", "000483"];
    for (const [index, format] of (["jpeg", "png", "webp"] as const).entries()) {
      await sharp({ create: { width: 24, height: 16, channels: 3, background: "blue" } }).toFormat(format).toFile(join(root, files[index]!));
    }
    await writeFile(join(root, "000481"), Buffer.from("00000018667479706865696300000000686569636d696631", "hex"));
    await writeFile(join(root, "000482"), "no es una imagen");
    await writeFile(join(root, "000483"), Buffer.from([0xff, 0xd8, 0xff, 0x00]));
    const formats = await detectFileFormats(root, files);
    assert.deepEqual([...formats.values()].sort(), ["heic", "jpeg", "jpeg", "png", "unknown", "webp"]);
    const plan = planFiles(files, new Set(["000480", "000481", "000482", "000483"]), formats);
    const forbidden = async () => { throw new Error("dry-run intento escribir"); };
    await processPlan(plan, { optimize: file => optimizeImage(join(root, file)), upload: forbidden,
      relate: forbidden, archive: forbidden, checkpoint: createJournal(root) }, { dryRun: true, canWrite: true, maxBytes: 1024 * 1024 });
    assert.deepEqual(plan.map(row => row.status), ["ready", "ready", "ready", "processingError", "unknownFormat", "processingError"]);
    assert.deepEqual(plan.slice(0, 3).map(row => row.image?.storagePath), ["000480.webp", "000480-1.webp", "000480-2.webp"]);
    assert.deepEqual((await readdir(root)).sort(), files.sort());
    assert.equal((await optimizeImage(join(root, "000480"))).info.width, 24);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// Se ejercita el SDK real y el adaptador del CLI con transporte HTTP en memoria.
// Ninguna peticion sale a la red. PostgreSQL se verifica aparte con la migracion.
function fakeRemote() {
  const objects = new Map<string, Buffer>();
  const rows = new Map<string, { id_item: string; orden: number; foto_url: string }>();
  let principal: string | null = null;
  let fail: "storage" | "database" | "secondary" | null = null;
  const client = createClient("https://example.supabase.co", "test-service-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = String(input);
      if (url.includes("/storage/v1/object/productos/")) {
        assert.equal(new Headers(init?.headers).get("x-upsert"), "true");
        const path = url.split("/productos/")[1]!;
        if (fail === "storage" || (fail === "secondary" && path.includes("-1"))) {
          return Response.json({ message: "Storage failure" }, { status: 500 });
        }
        objects.set(path, Buffer.from(init?.body as Uint8Array));
        return Response.json({ Key: `productos/${path}` });
      }
      assert.ok(url.endsWith("/rest/v1/rpc/register_product_image"));
      if (fail === "database") return Response.json({ message: "DB failure" }, { status: 400 });
      const body = JSON.parse(init?.body as string);
      const row = { id_item: body.p_id_item, orden: body.p_orden, foto_url: body.p_foto_url };
      rows.set(`${row.id_item}:${row.orden}`, row);
      if (row.orden === 1) principal = row.foto_url;
      return Response.json(row);
    } },
  });
  return { objects, rows, client, setFail(value: typeof fail) { fail = value; }, principal: () => principal };
}

test("dos tandas identicas y una correccion: mismas claves Storage/BD y principal estable", async () => {
  const remote = fakeRemote();
  let content = "version-1";
  const events: string[] = [];
  const effects = { ...remoteEffects(remote.client),
    optimize: async () => ({ data: Buffer.from(content), info: { width: 1, height: 1 } }),
    archive: async (file: string) => { events.push(file); } };
  for (let run = 0; run < 3; run++) {
    if (run === 2) content = "version-2";
    const plan = planFiles(["000480.jpg", "000480 (1).jpg"], new Set(["000480"]));
    await processPlan(plan, effects, { dryRun: false, canWrite: true, maxBytes: 100 });
    assert.ok(plan.every(row => row.status === "success"));
    assert.equal(remote.objects.size, 2);
    assert.equal(remote.rows.size, 2);
    assert.equal(remote.objects.get("000480.webp")?.toString(), content);
    assert.equal(remote.principal(), "https://example.supabase.co/storage/v1/object/public/productos/000480.webp");
  }
  assert.equal(events.length, 6);
});

for (const scenario of ["storage", "database", "move", "secondary"] as const) {
  test(`fallo parcial ${scenario}: estado remoto, diario durable y recuperacion`, async () => {
    const root = await mkdtemp(join(tmpdir(), "bb-fotos-failure-"));
    try {
      const remote = fakeRemote();
      remote.setFail(scenario === "move" ? null : scenario);
      const archived: string[] = [];
      let failMove = scenario === "move";
      const files = ["000480.jpg", "000480 (1).jpg"];
      const effects = { ...remoteEffects(remote.client), checkpoint: createJournal(root),
        optimize: async () => ({ data: Buffer.from("same"), info: { width: 1, height: 1 } }),
        archive: async (file: string) => { if (failMove) throw new Error("EACCES"); archived.push(file); } };
      const plan = planFiles(files, new Set(["000480"]));
      await processPlan(plan, effects, { dryRun: false, canWrite: true, maxBytes: 100 });
      const pending = await pendingImports(root);
      if (scenario === "storage") {
        assert.equal(remote.objects.size, 0); assert.equal(remote.rows.size, 0);
        assert.ok(pending.every(entry => entry.stage === "uploadAttempt"));
      } else if (scenario === "database") {
        assert.equal(remote.objects.size, 2); assert.equal(remote.rows.size, 0);
        assert.ok(pending.every(entry => entry.stage === "storageConfirmed"));
        const entry = pending[0]!;
        assert.match(reconciliationStatus(entry, remote.objects.get(entry.storagePath)!, null, "https://example.com/image"), /huerfano/);
      } else if (scenario === "move") {
        assert.equal(remote.objects.size, 2); assert.equal(remote.rows.size, 2);
        assert.ok(plan.every(row => row.status === "moveError"));
        assert.ok(pending.every(entry => entry.stage === "databaseConfirmed"));
      } else {
        assert.equal(plan[0]?.status, "success"); assert.equal(plan[1]?.status, "storageError");
        assert.equal(remote.objects.size, 1); assert.equal(remote.rows.size, 1);
        assert.ok(remote.principal()?.endsWith("/000480.webp"));
      }
      assert.equal(archived.length, scenario === "secondary" ? 1 : 0);
      remote.setFail(null); failMove = false;
      await processPlan(planFiles(files.filter(file => !archived.includes(file)), new Set(["000480"])),
        { ...effects, checkpoint: createJournal(root) }, { dryRun: false, canWrite: true, maxBytes: 100 });
      assert.equal(remote.objects.size, 2); assert.equal(remote.rows.size, 2);
      assert.equal((await pendingImports(root)).length, 0);
      assert.equal(archived.length, 2);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}

test("sin diario durable no se inicia Storage; lock impide dos cargas locales", async () => {
  const root = await mkdtemp(join(tmpdir(), "bb-fotos-lock-"));
  try {
    const release = await acquireImportLock(root);
    await assert.rejects(acquireImportLock(root), /EEXIST/);
    await release();
    const plan = planFiles(["000480.jpg"], new Set(["000480"]));
    const remote = fakeRemote();
    await processPlan(plan, { ...remoteEffects(remote.client),
      optimize: async () => ({ data: Buffer.from("image"), info: { width: 1, height: 1 } }),
      checkpoint: async () => { throw new Error("ENOSPC"); }, archive: async () => { assert.fail("No archivar"); },
    }, { dryRun: false, canWrite: true, maxBytes: 100 });
    assert.equal(remote.objects.size, 0); assert.equal(plan[0]?.status, "journalError");
    await writeFile(join(root, ".fotos-import-state", "broken.jsonl"), "{");
    await assert.rejects(pendingImports(root));
    assert.equal(await readFile(join(root, ".fotos-import-state", "broken.jsonl"), "utf8"), "{");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("respuesta de Storage perdida: el intento previo permite detectar y recuperar el objeto", async () => {
  const root = await mkdtemp(join(tmpdir(), "bb-fotos-uncertain-"));
  try {
    const remote = fakeRemote();
    const actual = remoteEffects(remote.client);
    const plan = planFiles(["000480.jpg"], new Set(["000480"]));
    await processPlan(plan, { ...actual, checkpoint: createJournal(root),
      optimize: async () => ({ data: Buffer.from("same"), info: { width: 1, height: 1 } }),
      upload: async (image, data) => { await actual.upload(image, data); throw new Error("Respuesta perdida"); },
      archive: async () => { assert.fail("No archivar una respuesta incierta"); },
    }, { dryRun: false, canWrite: true, maxBytes: 100 });
    const entry = (await pendingImports(root))[0]!;
    assert.equal(entry.stage, "uploadAttempt");
    assert.equal(remote.objects.size, 1);
    assert.equal(remote.rows.size, 0);
    assert.equal(plan[0]?.status, "storageError");
    assert.match(reconciliationStatus(entry, remote.objects.get(entry.storagePath)!, null, "https://example.com/x"), /huerfano/);
    assert.match(reconciliationStatus(entry, Buffer.from("changed"), null, "https://example.com/x"), /distinto/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("reintenta una lectura transitoria; nunca reintenta una escritura de transporte incierto", async () => {
  let calls = 0;
  const transport = adminFetch(async () => {
    if (++calls === 1) throw new TypeError("fetch failed");
    return Response.json({ ok: true });
  });
  assert.equal((await transport("https://example.com", { method: "GET" })).status, 200);
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(transport("https://example.com", { method: "POST" }), /fetch failed/);
  assert.equal(calls, 1);
});

test("duplicado reasignado conserva su objeto en reintento parcial sin pisar principal", async () => {
  const remote = fakeRemote();
  remote.setFail("secondary");
  const effects = { ...remoteEffects(remote.client),
    optimize: async (file: string) => ({ data: Buffer.from(file), info: { width: 1, height: 1 } }),
    archive: async () => undefined };
  const first = planFiles(["000480", "000480.png"], new Set(["000480"]));
  const assignments = assignOrders(first, [], [], true);
  await processPlan(first, effects, { dryRun: false, canWrite: true, maxBytes: 100 });
  assert.equal(first[0]?.status, "success"); assert.equal(first[1]?.status, "storageError");
  const retry = planFiles(["000480.png"], new Set(["000480"]));
  assignOrders(retry, assignments, [{ id_item: "000480", orden: 1 }], true);
  assert.equal(retry[0]?.image?.order, 2);
  remote.setFail(null);
  await processPlan(retry, effects, { dryRun: false, canWrite: true, maxBytes: 100 });
  assert.equal(remote.objects.size, 2); assert.equal(remote.rows.size, 2);
  assert.equal(remote.objects.get("000480.webp")?.toString(), "000480");
  assert.equal(remote.objects.get("000480-1.webp")?.toString(), "000480.png");
  assert.ok(remote.principal()?.endsWith("/000480.webp"));
});
