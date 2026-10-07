import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyAudit } from "./audit-policy";
import { assertBracesPatch, BRACES_ADVISORY, loadPatchedBraces } from "./braces-patch";

function report() {
  return {
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 } },
    advisories: { "1240992": {
      github_advisory_id: BRACES_ADVISORY, module_name: "braces", severity: "high",
      findings: [{ version: "3.0.3", dev: true,
        paths: [".>eslint-config-next>@next/eslint-plugin-next>fast-glob>micromatch>braces"] }],
    } },
  };
}

test("el parche real bloquea patrones y AST profundos conservando expansiones normales", () => {
  assertBracesPatch();
  const braces = loadPatchedBraces();
  assert.deepEqual(braces.expand("photo-{1..3}.webp"), ["photo-1.webp", "photo-2.webp", "photo-3.webp"]);
  assert.equal(braces.stringify("literal-\\{1\\}"), "literal-{1}");
  assert.throws(() => braces.parse("(".repeat(200) + "x" + ")".repeat(200)), /Maximum brace nesting depth/);
  assert.throws(() => braces.parse("{".repeat(200) + "x"), /Maximum brace nesting depth/);
});

test("solo reconoce la alerta exacta en la dependencia de desarrollo verificada", () => {
  assert.equal(classifyAudit(report()).mitigated.length, 1);
  for (const alteration of ["production", "other-path", "new-version", "other-advisory"]) {
    const input = report();
    const alert = input.advisories["1240992"];
    const finding = alert.findings[0]!;
    if (alteration === "production") finding.dev = false;
    if (alteration === "other-path") finding.paths = [".>app>braces"];
    if (alteration === "new-version") finding.version = "3.0.4";
    if (alteration === "other-advisory") alert.github_advisory_id = "GHSA-other";
    assert.equal(classifyAudit(input).unresolved.length, 1);
  }
});

test("errores de red o reportes incompletos no se confunden con auditorias limpias", () => {
  for (const input of [null, {}, { error: "network" }, { ...report(), advisories: {} }]) {
    assert.throws(() => classifyAudit(input));
  }
  const empty = report();
  empty.metadata.vulnerabilities.high = 0;
  assert.deepEqual(classifyAudit({ ...empty, advisories: {} }), { mitigated: [], unresolved: [] });
});
