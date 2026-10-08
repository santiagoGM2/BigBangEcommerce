import { spawnSync } from "node:child_process";
import { assertBracesPatch } from "./quality/braces-patch";
import { classifyAudit } from "./quality/audit-policy";

function main() {
  const pnpmEntry = process.env.npm_execpath;
  if (!pnpmEntry) throw new Error("Ejecutar mediante pnpm audit:dependencies.");
  const result = spawnSync(process.execPath, [pnpmEntry, "audit", "--json"], {
    encoding: "utf8", timeout: 120_000, maxBuffer: 10 * 1024 * 1024, windowsHide: true,
  });
  if (result.error || (result.status !== 0 && result.status !== 1)) {
    throw new Error("No se pudo completar pnpm audit.", { cause: result.error });
  }
  const { mitigated, unresolved } = classifyAudit(JSON.parse(result.stdout));
  // Siempre comprobar el parche instalado, incluso si el registro retira la alerta.
  assertBracesPatch();
  for (const alert of mitigated) {
    console.warn(`[mitigado localmente, aun reportado por npm] ${alert.github_advisory_id}: ${alert.module_name}. Parche local verificado en patches/braces@3.0.3.patch.`);
  }
  for (const alert of unresolved) {
    console.error(`[sin resolver] ${alert.github_advisory_id}: ${alert.module_name} (${alert.severity})`);
  }
  console.log(`Auditoria: ${unresolved.length} alertas sin resolver; ${mitigated.length} mitigada(s) con parche verificado y pruebas de regresion.`);
  if (unresolved.length > 0) process.exitCode = 1;
}

try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
