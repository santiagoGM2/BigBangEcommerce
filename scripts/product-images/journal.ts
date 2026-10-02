import { mkdir, open, readFile, readdir, unlink } from "node:fs/promises";
import { join, relative, resolve, isAbsolute } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { ImportEffects } from "./core";

type Stage = "uploadAttempt" | "storageConfirmed" | "databaseConfirmed" | "archived";
export type JournalEntry = {
  attempt: string; startedAt: string; stage: Stage; file: string;
  idItem: string; order: number; storagePath: string; sha256: string; url?: string;
};
export const hashImage = (data: Buffer) => createHash("sha256").update(data).digest("hex");

// Escritura previa a Storage, append-only y fsync. Una respuesta de red perdida
// sigue dejando un intento pendiente que el siguiente dry-run puede detectar.
export function createJournal(root: string): NonNullable<ImportEffects["checkpoint"]> {
  const attempts = new Map<string, { attempt: string; startedAt: string }>();
  return async (row, stage, data, url) => {
    const directory = join(root, ".fotos-import-state");
    await mkdir(directory, { recursive: true });
    let attempt = attempts.get(row.file);
    if (!attempt) {
      attempt = { attempt: randomUUID(), startedAt: new Date().toISOString() };
      attempts.set(row.file, attempt);
    }
    const entry: JournalEntry = { ...attempt, stage, file: row.file,
      idItem: row.image!.idItem, order: row.image!.order,
      storagePath: row.image!.storagePath, sha256: hashImage(data), url };
    const handle = await open(join(directory, `${row.image!.storagePath}.jsonl`), "a");
    try { await handle.writeFile(`${JSON.stringify(entry)}\n`); await handle.sync(); }
    finally { await handle.close(); }
  };
}

export async function pendingImports(root: string): Promise<JournalEntry[]> {
  const directory = join(root, ".fotos-import-state");
  let files;
  try { files = await readdir(directory); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const latest = new Map<string, JournalEntry>();
  for (const file of files.filter(file => file.endsWith(".jsonl"))) {
    const lines = (await readFile(join(directory, file), "utf8")).trim().split("\n");
    // Un diario truncado no se ignora silenciosamente: bloquea para revision.
    const entries = lines.map(line => JSON.parse(line) as JournalEntry);
    const last = entries.at(-1)!;
    if (!last?.storagePath || !last.startedAt || typeof last.file !== "string" ||
      !/^\d+$/.test(last.idItem) || !Number.isInteger(last.order) || last.order < 1 ||
      !/^[a-f0-9]{64}$/.test(last.sha256) ||
      last.storagePath !== `${last.idItem}${last.order === 1 ? "" : `-${last.order - 1}`}.webp` ||
      !["uploadAttempt", "storageConfirmed", "databaseConfirmed", "archived"].includes(last.stage)) {
      throw new Error(`Diario invalido: ${file}`);
    }
    const localPath = relative(root, resolve(root, last.file));
    if (!localPath || isAbsolute(localPath) || localPath.startsWith("..")) throw new Error(`Ruta invalida en diario: ${file}`);
    const previous = latest.get(last.storagePath);
    if (!previous || previous.startedAt <= last.startedAt) latest.set(last.storagePath, last);
  }
  return [...latest.values()].filter(entry => entry.stage !== "archived");
}

export function reconciliationStatus(entry: JournalEntry, object: Buffer | null, relationUrl: string | null, expectedUrl: string) {
  if (!object) return "Objeto ausente; original pendiente para reintento.";
  if (hashImage(object) !== entry.sha256) return "Objeto con contenido distinto al intento; revisar antes de reemplazar.";
  if (relationUrl !== expectedUrl) return "Posible objeto huerfano: contenido subido sin relacion coincidente. Reintentar el mismo original; no borrar automaticamente.";
  return "Storage y relacion coinciden; falta confirmar archivo local/diario. Reintento idempotente.";
}

export async function acquireImportLock(root: string) {
  const directory = join(root, ".fotos-import-state");
  await mkdir(directory, { recursive: true });
  const path = join(directory, "run.lock");
  const handle = await open(path, "wx");
  await handle.close();
  return () => unlink(path);
}
