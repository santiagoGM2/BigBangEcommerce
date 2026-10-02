import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import {
  archiveOriginal, catalogIds, createIdResolver, mapConcurrent, optimizeImage, parseImageName,
  planFiles, processPlan, scanFiles,
} from "./core";
import type { ImportEffects } from "./core";

test("preserva ceros y orden; acepta mayusculas y parentesis sin espacio", () => {
  assert.deepEqual(parseImageName("000480.jpg"), { idItem: "000480", order: 1, storagePath: "000480.webp" });
  assert.deepEqual(parseImageName("000480 (1).JPEG"), { idItem: "000480", order: 2, storagePath: "000480-1.webp" });
  assert.equal(parseImageName("000480(2).png")?.order, 3);
  for (const name of ["000480 (0).jpg", "000480 (-1).jpg", "480.png.exe", "480 (2147483647).jpg", "foto.jpg"]) {
    assert.equal(parseImageName(name), null);
  }
});

test("catalogo vacio/malformado falla cerrado; alias unico conserva ID real", () => {
  assert.throws(() => catalogIds([]));
  assert.throws(() => catalogIds([{ id_item: 480 as unknown as string }]));
  const plan = planFiles(["480.jpg", "000480.webp", "000480 (1)", "000480.gif"], catalogIds([{ id_item: "000480" }]));
  assert.deepEqual(plan.map(row => row.status), ["duplicate", "duplicate", "ready", "invalidExtension"]);
  assert.equal(plan[0]?.image?.idItem, "000480");
});

test("alias ambiguo falla cerrado y ID exacto tiene prioridad", () => {
  const lookup = createIdResolver(new Set(["000480", "00480", "000000", "014325"]));
  assert.equal(lookup("480"), null);
  assert.equal(lookup("000480"), "000480");
  assert.equal(lookup("0"), "000000");
  assert.equal(lookup("14325"), "014325");
  assert.equal(lookup("99999"), null);
});

test("rechaza todos los archivos que comparten destino, incluso entre carpetas", () => {
  const plan = planFiles(["000480.jpg", "otra/000480.png", "000480 (1).webp"], new Set(["000480"]));
  assert.deepEqual(plan.map(row => row.status), ["duplicate", "duplicate", "ready"]);
});

function effects(events: string[], fail?: "optimize" | "upload" | "relate" | "archive"): ImportEffects {
  function record(stage: string) { events.push(stage); if (stage === fail) throw new Error(stage); }
  return {
    optimize: async () => { record("optimize"); return { data: Buffer.from("webp"), info: { width: 100, height: 100 } }; },
    upload: async () => { record("upload"); return "https://example.com/000480.webp"; },
    relate: async () => { record("relate"); },
    archive: async () => { record("archive"); },
  };
}

test("dry-run optimiza pero nunca invoca efectos de escritura", async () => {
  const events: string[] = [];
  const plan = planFiles(["000480.jpg"], new Set(["000480"]));
  await processPlan(plan, effects(events), { dryRun: true, canWrite: true, maxBytes: 100 });
  assert.deepEqual(events, ["optimize"]);
  assert.equal(plan[0]?.status, "ready");
});

test("sin catalogo se optimiza para diagnostico pero jamas se sube", async () => {
  const events: string[] = [];
  const plan = planFiles(["000480.jpg"], null);
  await processPlan(plan, effects(events), { dryRun: false, canWrite: true, maxBytes: 100 });
  assert.deepEqual(events, ["optimize"]);
  assert.equal(plan[0]?.status, "blocked");
});

for (const [failure, status, expected] of [
  ["optimize", "processingError", ["optimize"]],
  ["upload", "storageError", ["optimize", "upload"]],
  ["relate", "databaseError", ["optimize", "upload", "relate"]],
  ["archive", "moveError", ["optimize", "upload", "relate", "archive"]],
] as const) {
  test(`fallo en ${failure} conserva el original y continua`, async () => {
    const events: string[] = [];
    const plan = planFiles(["000480.jpg", "000481.jpg"], new Set(["000480", "000481"]));
    await processPlan(plan, effects(events, failure), { dryRun: false, canWrite: true, maxBytes: 100 });
    assert.ok(plan.every(row => row.status === status));
    for (const stage of expected) assert.equal(events.filter(x => x === stage).length, 2);
    assert.equal(events.length, expected.length * 2);
  });
}

test("solo mueve despues de confirmar Storage y BD", async () => {
  const events: string[] = [];
  const plan = planFiles(["000480.jpg"], new Set(["000480"]));
  await processPlan(plan, effects(events), { dryRun: false, canWrite: true, maxBytes: 100 });
  assert.deepEqual(events, ["optimize", "upload", "relate", "archive"]);
  assert.equal(plan[0]?.status, "success");
});

test("nunca supera cinco trabajos simultaneos", async () => {
  let active = 0;
  let peak = 0;
  await mapConcurrent(Array.from({ length: 21 }), async () => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
  });
  assert.equal(peak, 5);
});

test("optimiza imagen real y rechaza imagen corrupta o contenido SVG", async () => {
  const root = await mkdtemp(join(tmpdir(), "bb-fotos-test-"));
  try {
    const file = join(root, "000480.png");
    await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "red" } }).png().toFile(file);
    const output = await optimizeImage(file);
    assert.equal(output.info.format, "webp");
    assert.equal(output.info.width, 1200);
    assert.equal(output.info.height, 600);
    await writeFile(file, "corrupta");
    await assert.rejects(optimizeImage(file));
    await writeFile(file, '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
    await assert.rejects(optimizeImage(file), /Contenido no permitido/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("escaneo ignora procesadas/ocultos y archivo repetido no sobrescribe originales", async () => {
  const root = await mkdtemp(join(tmpdir(), "bb-fotos-test-"));
  try {
    await mkdir(join(root, "procesadas"));
    await writeFile(join(root, ".DS_Store"), "oculto");
    await writeFile(join(root, "procesadas", "000480.jpg"), "anterior");
    await writeFile(join(root, "000480.jpg"), "corregida");
    assert.deepEqual((await scanFiles(root)).files, ["000480.jpg"]);
    await archiveOriginal(root, "000480.jpg");
    assert.equal(await readFile(join(root, "procesadas", "000480.jpg"), "utf8"), "anterior");
    assert.equal((await readdir(join(root, "procesadas"))).length, 2);
    assert.deepEqual((await scanFiles(root)).files, []);
    await assert.rejects(archiveOriginal(root, "../outside.jpg"), /fuera/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
