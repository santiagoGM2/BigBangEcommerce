import { spawnSync } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const gh = process.env.BIGBANG_GH_PATH;
if (!gh) throw new Error("Falta ruta local de GitHub CLI oficial.");
const credential = spawnSync("git", ["credential", "fill"], {
  input: "protocol=https\nhost=github.com\npath=santiagoGM2/BigBangEcommerce.git\n\n",
  encoding: "utf8", env: { ...process.env, GCM_INTERACTIVE: "Never" }, timeout: 30_000,
});
const token = /^password=(.+)$/m.exec(credential.stdout)?.[1]?.trim();
if (credential.status !== 0 || !token) throw new Error("Falta autenticacion Git autorizada.");
for (const name of ["CATALOGO_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name}`);
  const result = spawnSync(gh, ["secret", "set", name, "--repo", "santiagoGM2/BigBangEcommerce"], {
    input: value, encoding: "utf8", timeout: 30_000, env: { ...process.env, GH_TOKEN: token },
  });
  if (result.status !== 0) throw new Error(`No se pudo configurar ${name}; credenciales omitidas.`);
  console.log(`Secreto privado configurado: ${name}`);
}
