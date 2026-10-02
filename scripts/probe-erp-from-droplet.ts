import "server-only";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });
const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name}`);
  return value;
};
// Excepcion limitada y autorizada para el ERP: no altera HTTPS ni certificados.
if (process.env.ERP_DB_ALLOW_PLAINTEXT !== "true") throw new Error("Requiere ERP_DB_ALLOW_PLAINTEXT=true autorizado para esta prueba.");
const input = {
  host: required("ERP_DB_HOST"), port: required("ERP_DB_PORT"), user: required("ERP_DB_USER"),
  password: required("ERP_DB_PASSWORD"), database: required("ERP_DB_NAME"), view: required("ERP_DB_VIEW"),
  export: process.env.ERP_PROBE_EXPORT === "true",
  allowPlaintext: true,
};
const result = spawnSync("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "-i",
  resolve(process.env.USERPROFILE!, ".ssh/bigbang-do-admin"), "bigbang@204.48.26.102",
  "python3 /home/bigbang/probe-erp-view.py"], { input: JSON.stringify(input), encoding: "utf8", timeout: 180_000, maxBuffer: 64 * 1024 * 1024 });
if (result.stdout) process.stdout.write(result.stdout);
if (result.error || result.status !== 0) {
  console.error("La prueba remota fallo; revisar el codigo devuelto. No se imprimen credenciales.");
  process.exitCode = 1;
}
