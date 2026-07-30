/**
 * Regenera lib/supabase/database.types.ts desde el esquema real de Supabase.
 * Se corre con: pnpm gen:types
 *
 * Requiere que este instalada la CLI de Supabase globalmente o via npx.
 * Alternativa: pedirle a Claude que use el MCP de Supabase.
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "rzhzuvmrnfuctwyunhiu";
const OUT = resolve(process.cwd(), "lib/supabase/database.types.ts");

console.log(
  "[generate-supabase-types] regenerando desde el esquema de bigbang-ecommerce...",
);
const raw = execSync(
  `npx --yes supabase gen types typescript --project-id ${PROJECT_REF}`,
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);

const banner = `/**\n * ARCHIVO GENERADO — NO EDITAR A MANO\n *\n * Fuente: esquema real del proyecto Supabase bigbang-ecommerce\n * Regenerar: pnpm gen:types\n */\n\n`;
writeFileSync(OUT, banner + raw, "utf8");
console.log(`  -> ${OUT}`);
