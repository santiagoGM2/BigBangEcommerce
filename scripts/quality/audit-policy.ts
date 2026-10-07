import { BRACES_ADVISORY } from "./braces-patch";

interface Finding { version: string; dev: boolean; paths: string[] }
interface Advisory {
  github_advisory_id: string;
  module_name: string;
  severity: string;
  findings: Finding[];
}

/** No oculta alertas: solo clasifica la mitigacion local comprobada. */
export function classifyAudit(input: unknown) {
  if (!input || typeof input !== "object" || !("advisories" in input) || !("metadata" in input)) {
    throw new Error("Respuesta de auditoria ausente o con formato desconocido.");
  }
  const { advisories, metadata } = input as { advisories: unknown; metadata: unknown };
  if (!advisories || typeof advisories !== "object" || !metadata || typeof metadata !== "object") {
    throw new Error("Respuesta de auditoria invalida.");
  }
  const vulnerabilities = (metadata as { vulnerabilities?: Record<string, number> }).vulnerabilities;
  if (!vulnerabilities || ["info", "low", "moderate", "high", "critical"].some(level =>
    typeof vulnerabilities[level] !== "number" || !Number.isInteger(vulnerabilities[level]) || vulnerabilities[level]! < 0,
  )) throw new Error("La auditoria no incluye conteos validos.");

  const alerts = Object.values(advisories) as Advisory[];
  if (Object.values(vulnerabilities).reduce((sum, count) => sum + count, 0) !== alerts.length) {
    throw new Error("Los conteos de la auditoria no coinciden con sus alertas.");
  }
  const mitigated: Advisory[] = [];
  const unresolved: Advisory[] = [];
  for (const alert of alerts) {
    if (
      alert.github_advisory_id === BRACES_ADVISORY && alert.module_name === "braces" &&
      Array.isArray(alert.findings) && alert.findings.length > 0 && alert.findings.every(finding =>
        finding.version === "3.0.3" && finding.dev === true && Array.isArray(finding.paths) &&
        finding.paths.length > 0 && finding.paths.every(path =>
          path === ".>eslint-config-next>@next/eslint-plugin-next>fast-glob>micromatch>braces",
        ),
      )
    ) mitigated.push(alert);
    else unresolved.push(alert);
  }
  return { mitigated, unresolved };
}
