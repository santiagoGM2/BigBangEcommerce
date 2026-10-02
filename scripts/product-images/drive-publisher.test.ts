import assert from "node:assert/strict";
import { test } from "node:test";
import { publishDriveImage, type DriveAttempt, type DriveSource, type DrivePublishEffects } from "./drive-publisher";
import { assignOrders } from "./assignments";
import { planFiles } from "./core";

const source: DriveSource = { source_key: "DriveFileA", id_item: "000480", orden: 1,
  source_name: "000480.jpg", observed_version: "1", published_version: null, published_url: null };

function harness() {
  const objects = new Map<string, Buffer>();
  const attempts = new Map<string, DriveAttempt>();
  const relations = new Map<string, string>();
  let principal: string | null = null;
  let fail: "storage" | "database" | "lease" | "response" | undefined;
  const effects: DrivePublishEffects = {
    assertLease: async () => { if (fail === "lease") throw new Error("expired"); },
    prepare: async (s, sha, path) => {
      const key = `${s.source_key}/${s.observed_version}/${sha}`;
      const attempt = attempts.get(key) ?? { source_key: s.source_key, source_version: s.observed_version,
        sha256: sha, storage_path: path, uploaded_at: null, completed_at: null, last_error: null };
      attempts.set(key, attempt); return attempt;
    },
    upload: async (path, bytes) => {
      if (fail === "storage") throw new Error("Storage failed");
      objects.set(path, bytes); return `https://storage.example/${path}`;
    },
    confirmUpload: async (s, sha) => { attempts.get(`${s.source_key}/${s.observed_version}/${sha}`)!.uploaded_at = "now"; },
    complete: async (s, sha, url) => {
      if (fail === "database") throw new Error("Database failed");
      relations.set(`${s.id_item}/${s.orden}`, url);
      if (s.orden === 1) principal = url;
      attempts.get(`${s.source_key}/${s.observed_version}/${sha}`)!.completed_at = "now";
      if (fail === "response") throw new Error("Response lost");
      return { ...s, published_version: s.observed_version, published_url: url };
    },
  };
  return { effects, objects, attempts, relations, get principal() { return principal; }, setFail(value: typeof fail) { fail = value; } };
}

test("Drive: repetir contenido/version conserva un objeto, una relacion y un intento", async () => {
  const h = harness(); const bytes = Buffer.from("optimized-image");
  const a = await publishDriveImage(source, bytes, h.effects);
  const b = await publishDriveImage(source, bytes, h.effects);
  assert.deepEqual(a, b); assert.equal(h.objects.size, 1); assert.equal(h.relations.size, 1);
  assert.equal(h.attempts.size, 1); assert.equal(h.principal, a.url);
});

test("Drive: BD fallida deja intento pendiente y principal anterior intacta; reintento concilia", async () => {
  const h = harness(); const first = await publishDriveImage(source, Buffer.from("old"), h.effects);
  const correction = { ...source, observed_version: "2" };
  h.setFail("database");
  await assert.rejects(publishDriveImage(correction, Buffer.from("new"), h.effects));
  assert.equal(h.principal, first.url); assert.equal(h.relations.size, 1);
  assert.equal([...h.attempts.values()].filter(a => !a.completed_at).length, 1);
  h.setFail(undefined);
  const updated = await publishDriveImage(correction, Buffer.from("new"), h.effects);
  assert.equal(h.principal, updated.url); assert.equal(h.relations.size, 1);
  assert.equal(h.objects.size, 2); assert.ok([...h.attempts.values()].every(a => a.completed_at));
});

test("Drive: fallo de Storage no publica; intento permanece detectable", async () => {
  const h = harness(); h.setFail("storage");
  await assert.rejects(publishDriveImage(source, Buffer.from("image"), h.effects));
  assert.equal(h.objects.size, 0); assert.equal(h.relations.size, 0);
  assert.equal(h.attempts.size, 1); assert.equal(h.principal, null);
});

test("Drive: respuesta BD perdida se recupera sin duplicados", async () => {
  const h = harness(); h.setFail("response");
  await assert.rejects(publishDriveImage(source, Buffer.from("image"), h.effects));
  h.setFail(undefined); await publishDriveImage(source, Buffer.from("image"), h.effects);
  assert.equal(h.objects.size, 1); assert.equal(h.relations.size, 1); assert.equal(h.attempts.size, 1);
});

test("Drive: secundaria fallida no altera principal confirmada", async () => {
  const h = harness(); const first = await publishDriveImage(source, Buffer.from("main"), h.effects);
  h.setFail("storage");
  await assert.rejects(publishDriveImage({ ...source, source_key: "DriveFileB", orden: 2 }, Buffer.from("secondary"), h.effects));
  assert.equal(h.principal, first.url); assert.equal(h.relations.size, 1);
});

test("Drive: bloqueo expirado impide Storage y relaciones", async () => {
  const h = harness(); h.setFail("lease");
  await assert.rejects(publishDriveImage(source, Buffer.from("image"), h.effects));
  assert.equal(h.objects.size, 0); assert.equal(h.attempts.size, 0); assert.equal(h.relations.size, 0);
});

test("colisiones de un ID inexistente nunca se convierten en listas para subir", () => {
  const plan = planFiles(["000480.jpg", "000480.png"], new Set(["000481"]));
  assignOrders(plan, [], [], true);
  assert.deepEqual(plan.map(row => row.status), ["unknownId", "unknownId"]);
});
