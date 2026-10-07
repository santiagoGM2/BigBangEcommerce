import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
function required(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Falta ${name}`);
  return value;
}

function main(): void {
  if (process.env.ERP_DB_ALLOW_PLAINTEXT !== "true") {
    throw new Error("Falta politica autorizada del ERP.");
  }
  const target = required("ERP_PROXY_SSH_TARGET");
  const keyPath = required("ERP_PROXY_SSH_KEY_PATH");
  if (!/^[a-z_][a-z0-9_-]*@[a-z0-9][a-z0-9.-]*$/i.test(target)) {
    throw new Error("ERP_PROXY_SSH_TARGET debe tener formato usuario@host.");
  }
  if (!isAbsolute(keyPath)) throw new Error("ERP_PROXY_SSH_KEY_PATH debe ser una ruta absoluta.");
  const patch = {
    host: required("ERP_DB_HOST"), port: required("ERP_DB_PORT"),
    user: required("ERP_DB_USER"), password: required("ERP_DB_PASSWORD"),
    database: required("ERP_DB_NAME"), view: required("ERP_DB_VIEW"),
    allowPlaintext: true, apiKey: required("CATALOGO_API_KEY"),
  };
  // El codigo no contiene secretos; las credenciales viajan solo por stdin de SSH.
  // El actualizador conserva pricePolicy y todos los campos que no se cambian.
  const program = readFileSync(new URL("../ops/catalog-proxy/update_config.py", import.meta.url)).toString("base64");
  const command = `sudo -n python3 -c 'import base64;exec(compile(base64.b64decode("${program}"), "update_config.py", "exec"))'`;
  const result = spawnSync("ssh", [
    "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "-o", "StrictHostKeyChecking=yes",
    "-i", keyPath, target, command,
  ], { input: JSON.stringify(patch), encoding: "utf8", timeout: 30_000 });
  if (result.error || result.status !== 0) {
    throw new Error("No se confirmo la actualizacion remota. Revise conexion, permisos, configuracion y bloqueo antes de reintentar.");
  }
  console.log("Configuracion verificada; politica de precios conservada. Credenciales omitidas. El servicio no se reinicio.");
}

main();
