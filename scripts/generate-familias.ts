/**
 * Transcribe _data/categorias-erp.csv a lib/catalogo/familias.ts.
 * Se corre con: pnpm gen:familias
 *
 * El resultado se commitea: en runtime no leemos el CSV, para tener tipos
 * fuertes y cero lecturas de disco.
 *
 * Este script FALLA RUIDOSAMENTE si el CSV no cuadra: un familias.ts
 * silenciosamente incompleto es peor que no tener el archivo.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FAMILIA_SLUGS, type FamiliaSlug } from "../lib/catalogo/familias-meta.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

const CSV_PATH = join(REPO_ROOT, "_data", "categorias-erp.csv");
const OUT_PATH = join(REPO_ROOT, "lib", "catalogo", "familias.ts");

// ---- constantes de validacion ----------------------------------------------

// El CSV tiene 164 categorias del ERP (mas la fila de encabezado).
const EXPECTED_ROWS = 164;

// Slugs de familia validos. Se toma del meta para tener una sola fuente.
const VALID_FAMILIAS = new Set<string>(FAMILIA_SLUGS);

// Acciones validas en la columna `accion`.
const VALID_ACCIONES = new Set(["", "OCULTAR", "CONFIRMAR"]);

// ---- parseo -----------------------------------------------------------------

interface Fila {
  linea: number; // linea del CSV (1-based, incluye encabezado)
  rank: number;
  count: number;
  categoria: string;
  accion: string;
  familia: string;
}

function parseCsv(raw: string): Fila[] {
  // Excel y varios editores en Windows agregan BOM UTF-8 al inicio del archivo.
  const clean = raw.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    throw new Error("CSV vacio");
  }

  const header = splitCsvLine(lines[0]!);
  const expected = ["rank", "count", "categoria", "accion", "familia"];
  if (header.length !== expected.length || !expected.every((h, i) => header[i] === h)) {
    throw new Error(
      `Encabezado inesperado. Esperado ${JSON.stringify(expected)}, recibido ${JSON.stringify(header)}`,
    );
  }

  return lines.slice(1).map((raw, i) => {
    const cols = splitCsvLine(raw);
    if (cols.length !== 5) {
      throw new Error(
        `Linea ${i + 2}: se esperaban 5 columnas, hay ${cols.length}. Contenido: ${raw}`,
      );
    }
    const [rank, count, categoria, accion, familia] = cols as [
      string,
      string,
      string,
      string,
      string,
    ];
    return {
      linea: i + 2,
      rank: Number.parseInt(rank, 10),
      count: Number.parseInt(count, 10),
      categoria,
      accion,
      familia,
    };
  });
}

/** Parser mini de CSV: soporta comillas dobles alrededor de cada campo. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// ---- validacion -------------------------------------------------------------

function validate(rows: Fila[]): void {
  const errors: string[] = [];

  if (rows.length !== EXPECTED_ROWS) {
    errors.push(
      `Se esperaban ${EXPECTED_ROWS} filas, se leyeron ${rows.length}. Si el CSV cambio ` +
        `intencionalmente, ajusta EXPECTED_ROWS en scripts/generate-familias.ts.`,
    );
  }

  const categoriasVistas = new Set<string>();
  const familiasUsadas = new Set<string>();

  for (const fila of rows) {
    const loc = `linea ${fila.linea} (categoria "${fila.categoria}")`;

    if (!Number.isInteger(fila.rank) || fila.rank <= 0) {
      errors.push(`${loc}: rank invalido "${fila.rank}"`);
    }
    if (!Number.isInteger(fila.count) || fila.count < 0) {
      errors.push(`${loc}: count invalido "${fila.count}"`);
    }
    if (fila.categoria.trim().length === 0) {
      errors.push(`${loc}: categoria vacia`);
    }
    if (categoriasVistas.has(fila.categoria)) {
      errors.push(`${loc}: categoria duplicada`);
    }
    categoriasVistas.add(fila.categoria);

    if (!VALID_ACCIONES.has(fila.accion)) {
      errors.push(`${loc}: accion invalida "${fila.accion}" (validas: "", OCULTAR, CONFIRMAR)`);
    }

    if (fila.accion === "OCULTAR") {
      // Regla: OCULTAR debe tener familia vacia.
      if (fila.familia.trim().length !== 0) {
        errors.push(
          `${loc}: OCULTAR debe tener familia vacia, pero trae "${fila.familia}"`,
        );
      }
    } else {
      // Regla: toda fila que no sea OCULTAR debe tener familia asignada.
      if (fila.familia.trim().length === 0) {
        errors.push(`${loc}: familia vacia (solo permitido para OCULTAR)`);
      } else if (!VALID_FAMILIAS.has(fila.familia)) {
        errors.push(
          `${loc}: familia "${fila.familia}" no es una de las 14 esperadas. ` +
            `Validas: ${[...VALID_FAMILIAS].sort().join(", ")}`,
        );
      } else {
        familiasUsadas.add(fila.familia);
      }
    }
  }

  // Regla: los slugs de familia usados son exactamente las 14, ninguno menos ni de mas.
  const faltantes = [...VALID_FAMILIAS].filter((f) => !familiasUsadas.has(f));
  if (faltantes.length > 0) {
    errors.push(
      `Familias sin categorias asignadas: ${faltantes.join(", ")}. ` +
        `Si esto es intencional (familia sin productos hoy), quitala de familias-meta.ts.`,
    );
  }

  if (errors.length > 0) {
    console.error("\n[generate-familias] Validacion fallida:\n");
    for (const e of errors) console.error("  - " + e);
    console.error("");
    process.exit(1);
  }
}

// ---- generacion del archivo ------------------------------------------------

function generate(rows: Fila[]): string {
  const filasVisibles = rows.filter((r) => r.accion !== "OCULTAR");

  const entries = filasVisibles
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((r) => {
      const key = JSON.stringify(r.categoria);
      const familia = r.familia as FamiliaSlug;
      const flag = r.accion === "CONFIRMAR" ? ', requiereConfirmacion: true' : "";
      return `  [${key}, { familia: ${JSON.stringify(familia)}${flag} }],`;
    })
    .join("\n");

  const ocultas = rows
    .filter((r) => r.accion === "OCULTAR")
    .map((r) => `  ${JSON.stringify(r.categoria)},`)
    .join("\n");

  return `/**
 * ARCHIVO GENERADO — NO EDITAR A MANO
 *
 * Fuente: _data/categorias-erp.csv (${rows.length} filas)
 * Regenerar: pnpm gen:familias
 *
 * Este mapa cruza el nombre CRUDO de la categoria del ERP (columna
 * \`categoria\` del proxy) con la familia comercial visible al usuario.
 * Los nombres del ERP van en MAYUSCULAS y con abreviaturas, no los edites.
 */

import type { FamiliaSlug } from "./familias-meta";

export interface CategoriaMapeada {
  familia: FamiliaSlug;
  /**
   * true si la categoria esta marcada como CONFIRMAR en el CSV (el cliente
   * aun no confirma si debe verse). Cuando el flag
   * OCULTAR_CATEGORIAS_POR_CONFIRMAR se activa, estas se filtran.
   */
  requiereConfirmacion?: boolean;
}

/** Map<nombre exacto del ERP, familia asignada>. */
export const CATEGORIA_A_FAMILIA: ReadonlyMap<string, CategoriaMapeada> = new Map([
${entries}
]);

/**
 * Categorias del ERP marcadas OCULTAR: nunca se muestran, sin flag.
 * Son consumo interno, transporte, o articulos discontinuados.
 */
export const CATEGORIAS_OCULTAS: ReadonlySet<string> = new Set([
${ocultas}
]);
`;
}

// ---- main -------------------------------------------------------------------

const raw = readFileSync(CSV_PATH, "utf8");
const rows = parseCsv(raw);
validate(rows);
mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, generate(rows), "utf8");

const totalMapeadas = rows.filter((r) => r.accion !== "OCULTAR").length;
const totalOcultas = rows.filter((r) => r.accion === "OCULTAR").length;
const totalConfirmar = rows.filter((r) => r.accion === "CONFIRMAR").length;

console.log(`[generate-familias] OK`);
console.log(`  ${rows.length} categorias en el CSV`);
console.log(`  ${totalMapeadas} mapeadas a familias (${totalConfirmar} marcadas CONFIRMAR)`);
console.log(`  ${totalOcultas} ocultas`);
console.log(`  -> ${OUT_PATH}`);
