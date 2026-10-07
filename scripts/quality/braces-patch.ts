import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

export const BRACES_ADVISORY = "GHSA-vfj7-8cjw-p6xm";

type AstNode = { type: string; nodes?: AstNode[]; value?: string; [key: string]: unknown };
interface Braces {
  compile(input: string | AstNode): string;
  expand(input: string | AstNode): string[];
  stringify(input: string | AstNode): string;
  parse(input: string): AstNode;
}

export function loadPatchedBraces(): Braces {
  // Resolver la copia usada por ESLint, no una dependencia de prueba distinta.
  const require = createRequire(import.meta.url);
  const nextConfig = createRequire(require.resolve("eslint-config-next"));
  const nextRules = createRequire(nextConfig.resolve("@next/eslint-plugin-next"));
  const fastGlob = createRequire(nextRules.resolve("fast-glob"));
  const micromatch = createRequire(fastGlob.resolve("micromatch"));
  return micromatch("braces") as Braces;
}

export function assertBracesPatch() {
  const patch = readFileSync(new URL("../../patches/braces@3.0.3.patch", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.equal(
    createHash("sha256").update(patch).digest("hex"),
    "4e795278b150f5105598d25e68626ab32673420cfa693797a045a96653d54804",
    "El parche de braces cambio: requiere revision y pruebas antes de aceptar la mitigacion.",
  );

  const braces = loadPatchedBraces();
  const error = { name: "SyntaxError", message: "Maximum brace nesting depth exceeded (100)" };
  const pattern = "{".repeat(4_000) + "a,b" + "}".repeat(4_000);
  for (const operation of [braces.parse, braces.compile, braces.expand, braces.stringify]) {
    assert.throws(() => operation(pattern), error);
  }
  // El AST tambien se puede proporcionar directamente, sin pasar por parse().
  let tree: AstNode = { type: "text", value: "x" };
  for (let depth = 0; depth < 150; depth++) {
    tree = { type: "brace", nodes: [
      { type: "open", value: "{" }, tree, { type: "close", value: "}" },
    ], open: true, close: true, ranges: 0, commas: 0 };
  }
  const ast = { type: "root", nodes: [tree] };
  for (const operation of [braces.compile, braces.expand, braces.stringify]) {
    assert.throws(() => operation(structuredClone(ast)), error);
  }
  assert.deepEqual(braces.expand("src/{app,lib}/{a,b}.ts"), [
    "src/app/a.ts", "src/app/b.ts", "src/lib/a.ts", "src/lib/b.ts",
  ]);
}
