import assert from "node:assert/strict";
import { test } from "node:test";
import type { Outcome } from "./core";
import { buildDriveRunReport, renderDriveRunSummary } from "./drive-report";

function report(rows: Outcome[], options: { dryRun?: boolean; catalogAvailable?: boolean; pendingAttempts?: number } = {}) {
  return buildDriveRunReport({ dryRun: false, catalogAvailable: true, found: rows.length, ignored: 0,
    optimized: 1, unchanged: 0, pendingAttempts: 0, rows, ...options });
}

function row(status: Outcome["status"], file = "drive-id/000480.jpg"): Outcome {
  return { file, status, image: { idItem: "000480", order: 1, storagePath: "000480.webp" } };
}

test("publicación continúa con imagen inválida e ID pendiente sin afirmar que todas se publicaron", () => {
  const result = report([row("success"), row("ready", "unchanged/000481.jpg"),
    { ...row("invalidImage", "broken/28502-6.jpg"), detail: "VipsJpeg: Corrupt JPEG data: bad Huffman code" },
    row("unknownId", "missing/2900"), row("unknownId", "missing-secondary/2900 (1)")]);
  assert.equal(result.outcome, "completed_with_issues");
  assert.equal(result.exitCode, 0);
  assert.equal(result.counts.published, 1);
  assert.equal(result.counts.invalidImages, 1);
  assert.equal(result.counts.unknownIdFiles, 2);
  assert.equal(result.counts.unknownIds, 1);
  assert.equal(result.counts.otherErrors, 0);
  const summary = renderDriveRunSummary(result);
  assert.match(summary, /Completado con incidencias de archivos/);
  assert.match(summary, /28502-6\.jpg/);
  assert.match(summary, /requiere reemplazo por una copia válida/);
  assert.match(summary, /bad Huffman code/);
  assert.doesNotMatch(summary, /drive-id\/000480/);
});

for (const status of ["unknownId", "invalidImage"] as const) {
  test(`dry-run mantiene validación estricta ante ${status}`, () => {
    const result = report([row("ready"), row(status)], { dryRun: true });
    assert.equal(result.outcome, "failed");
    assert.equal(result.exitCode, 1);
    assert.match(renderDriveRunSummary(result), /La validación es estricta/);
  });
}

for (const [status, detail] of [
  ["storageError", "Storage HTTP 503"],
  ["databaseError", "BD no disponible"],
  ["processingError", "ENOSPC: no hay espacio para el temporal"],
  ["processingError", "Drive API respondio HTTP 403"],
  ["processingError", "Archivo cambio durante la descarga o checksum incorrecto."],
  ["processingError", "fetch failed"],
  ["processingError", "Error inesperado del decodificador"],
  ["blocked", "El archivo se renombro a otro ID; requiere revision."],
] as const) {
  test(`no oculta fallo ${status}: ${detail}`, () => {
    const result = report([row("success"), { ...row(status), detail }]);
    assert.equal(result.outcome, "failed");
    assert.equal(result.exitCode, 1);
    assert.equal(result.counts.otherErrors, 1);
    assert.ok(result.rows.some(item => item.detail === detail));
  });
}

test("sin catálogo o con intento pendiente no declara la ejecución terminada", () => {
  const pending = report([row("success")], { pendingAttempts: 1 });
  assert.equal(pending.outcome, "failed");
  assert.equal(pending.exitCode, 1);
  assert.match(renderDriveRunSummary(pending), /Existen intentos pendientes/);
  const missingCatalog = report([row("ready")], { catalogAvailable: false });
  assert.equal(missingCatalog.outcome, "failed");
  assert.equal(missingCatalog.exitCode, 1);
  assert.match(renderDriveRunSummary(missingCatalog), /no se declaran IDs inexistentes/);
});

test("estado desconocido falla cerrado", () => {
  const result = report([row("new-unrecognized-state" as Outcome["status"])]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.counts.otherErrors, 1);
});

test("lote sano informa éxito y mantiene conteos sin cambios", () => {
  const result = buildDriveRunReport({ dryRun: false, catalogAvailable: true, found: 5, ignored: 1,
    optimized: 2, unchanged: 2, pendingAttempts: 0, rows: [row("success"), row("success"), row("ready"), row("ready")] });
  assert.equal(result.outcome, "success");
  assert.equal(result.exitCode, 0);
  assert.equal(result.counts.published, 2);
  assert.equal(result.counts.unchanged, 2);
  assert.equal(result.counts.found, 5);
  assert.equal(result.counts.ignored, 1);
  assert.doesNotMatch(renderDriveRunSummary(result), /Archivos pendientes de revisión/);
  assert.equal(report([row("ready")], { dryRun: true }).outcome, "success");
});

test("escapa nombres y detalles externos sin permitir HTML, enlaces o nuevas filas", () => {
  const maliciousName = 'drive-id/28502|<img src=x onerror=alert(1)>![x](https://evil.test)\n|forged|`name`.jpg';
  const result = report([{ ...row("invalidImage", maliciousName), detail: '<script>alert(1)</script>\r\n| injected | &amp;' }]);
  const summary = renderDriveRunSummary(result);
  assert.doesNotMatch(summary, /<img|<script|!\[x\]|\|forged\||\| injected \|/);
  assert.match(summary, /&#124;/);
  assert.match(summary, /&#60;img/);
  assert.match(summary, /&#96;name&#96;/);
  assert.equal(summary.split("\n").filter(line => line.startsWith("| ")).length, 3);
  assert.equal(result.rows[0]?.file, maliciousName);
});

test("JSON serializa solamente campos del informe y copia las filas", () => {
  const source = { ...row("invalidImage"), detail: "[REDACTADO]", client: { token: "do-not-copy" } };
  const result = report([source]);
  source.file = "changed";
  source.image!.idItem = "999999";
  const json = JSON.stringify(result);
  assert.doesNotMatch(json, /do-not-copy|"client"|"changed"|999999/);
  assert.equal(JSON.parse(json).rows[0].detail, "[REDACTADO]");
  assert.equal(result.rows[0]?.image?.idItem, "000480");
});
