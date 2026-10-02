import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assignOrders, loadAssignments, saveAssignments } from "./assignments";
import { parseImageName, planFiles } from "./core";

test("ID canonico sin perder ceros persiste y se reutiliza; asignacion distinta se bloquea", async () => {
  const root = await mkdtemp(join(tmpdir(), "bb-fotos-canonical-"));
  try {
    const ids = new Set(["014325"]);
    const first = planFiles(["14325", "14325.png"], ids);
    const assignments = assignOrders(first, [], [], true);
    await saveAssignments(root, "https://example.supabase.co", assignments);
    const previous = await loadAssignments(root, "https://example.supabase.co");
    assert.deepEqual(assignOrders(planFiles(["14325", "14325.png"], ids), previous, [], true), assignments);
    assert.ok(assignments.every(row => row.idItem === "014325"));
    const changed = planFiles(["14325"], new Set(["0014325"]));
    assignOrders(changed, previous, [], true);
    assert.equal(changed[0]?.status, "blocked");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("sufijos con guion y parentesis representan el mismo ID/orden", () => {
  assert.deepEqual(parseImageName("000480-1"), parseImageName("000480 (1).heic"));
  assert.equal(parseImageName("000480-2.png")?.order, 3);
  assert.equal(parseImageName("000480-0"), null);
  assert.equal(parseImageName("000480--1"), null);
});

test("conserva cada duplicado, reserva secundarios explicitos y no depende del orden de entrada", () => {
  const files = ["000480", "000480.png", "000480(1)", "000480 (1).png", "000480-3"];
  const ids = new Set(["000480"]);
  const plan = planFiles(files, ids);
  const assignments = assignOrders(plan, [], [], true);
  assert.equal(plan.find(row => row.file === "000480")?.image?.order, 1);
  assert.equal(plan.find(row => row.file === "000480(1)")?.image?.order, 2);
  assert.equal(plan.find(row => row.file === "000480-3")?.image?.order, 4);
  assert.equal(new Set(plan.map(row => row.image?.storagePath)).size, files.length);
  assert.ok(plan.every(row => row.status === "ready"));
  assert.deepEqual(assignOrders(planFiles([...files].reverse(), ids), [], [], true), assignments);
});

test("registro persistido conserva orden en reintento parcial, lote repetido y correccion", async () => {
  const root = await mkdtemp(join(tmpdir(), "bb-fotos-assignment-"));
  try {
    const files = ["000480", "000480.png", "000480(1)"];
    const plan = planFiles(files, new Set(["000480"]));
    const initial = assignOrders(plan, [], [], true);
    assert.equal(initial.find(entry => entry.file === "000480.png")?.order, 3);
    await saveAssignments(root, "https://example.supabase.co", initial);
    const persisted = await loadAssignments(root, "https://example.supabase.co");
    const remaining = planFiles(["000480.png"], new Set(["000480"]));
    assignOrders(remaining, persisted, [{ id_item: "000480", orden: 1 }, { id_item: "000480", orden: 2 }], true);
    assert.equal(remaining[0]?.image?.order, 3);
    assert.deepEqual(assignOrders(planFiles(files, new Set(["000480"])), persisted, [], true), initial);
    const newSecondary = planFiles(["000480 (2).jpg"], new Set(["000480"]));
    assignOrders(newSecondary, persisted, [], true);
    assert.equal(newSecondary[0]?.image?.order, 4);
    await assert.rejects(loadAssignments(root, "https://other.supabase.co"), /otro proyecto/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("sin registro local no sobrescribe posiciones remotas existentes", () => {
  const plan = planFiles(["000480.jpg"], new Set(["000480"]));
  assignOrders(plan, [], [{ id_item: "000480", orden: 1 }], true);
  assert.equal(plan[0]?.image?.order, 2);
  assert.equal(plan[0]?.reassigned, true);
});

test("sin catalogo resuelve asignaciones pero nunca declara un ID validado", () => {
  const plan = planFiles(["000480", "000480.png"], null);
  assignOrders(plan, [], [], false);
  assert.ok(plan.every(row => row.status === "catalogUnavailable"));
});
