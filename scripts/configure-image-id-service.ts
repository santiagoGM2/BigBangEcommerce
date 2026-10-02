import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name}`);
  return value;
};
if (process.env.ERP_DB_ALLOW_PLAINTEXT !== "true") throw new Error("Falta politica autorizada del ERP.");
const cfg = { host: required("ERP_DB_HOST"), port: required("ERP_DB_PORT"), user: required("ERP_DB_USER"),
  password: required("ERP_DB_PASSWORD"), database: required("ERP_DB_NAME"), view: required("ERP_DB_VIEW"),
  allowPlaintext: true, apiKey: required("CATALOGO_API_KEY") };
const result = spawnSync("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "-i",
  resolve(process.env.USERPROFILE!, ".ssh/bigbang-do-admin"), "bigbang@204.48.26.102",
  "sudo install -d -m 750 -o root -g bigbang /etc/bigbang && sudo install -m 640 -o root -g bigbang /dev/null /etc/bigbang/catalog-config.json && sudo tee /etc/bigbang/catalog-config.json >/dev/null"],
{ input: JSON.stringify(cfg), encoding: "utf8", timeout: 30_000 });
if (result.error || result.status !== 0) throw new Error("No se guardo la configuracion remota.");
console.log("Configuracion guardada por SSH; permisos root:bigbang 0640. Credenciales omitidas.");
