import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ImageName, Outcome } from "./core";
import { parseImageName } from "./core";

export type Assignment = ImageName & { file: string };
export type OccupiedSlot = { id_item: string; orden: number };
const objectPath = (id: string, order: number) => `${id}${order === 1 ? "" : `-${order - 1}`}.webp`;

export async function loadAssignments(root: string, projectUrl: string): Promise<Assignment[]> {
  let text: string;
  try { text = await readFile(join(root, ".fotos-import-state", "assignments.json"), "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const manifest = JSON.parse(text) as { version: number; projectUrl: string; assignments: Assignment[] };
  if (manifest.version !== 1 || manifest.projectUrl !== projectUrl || !Array.isArray(manifest.assignments)) {
    throw new Error("Registro de asignaciones invalido o de otro proyecto.");
  }
  const files = new Set<string>();
  const slots = new Set<string>();
  for (const entry of manifest.assignments) {
    const name = typeof entry.file === "string" ? entry.file.split(/[\\/]/).at(-1)! : "";
    const namedId = parseImageName(name)?.idItem;
    if (!namedId || typeof entry.idItem !== "string" || !/^\d+$/.test(entry.idItem) ||
      namedId.replace(/^0+(?=\d)/, "") !== entry.idItem.replace(/^0+(?=\d)/, "") || !Number.isInteger(entry.order) || entry.order < 1 ||
      entry.order > 2147483647 || entry.storagePath !== objectPath(entry.idItem, entry.order) ||
      files.has(entry.file) || slots.has(entry.storagePath)) throw new Error("Registro con asignaciones ambiguas.");
    files.add(entry.file); slots.add(entry.storagePath);
  }
  return manifest.assignments;
}

// Reserva primero TODAS las posiciones explicitas y anteriores. Solo despues
// distribuye colisiones en los huecos libres: nunca desplaza una secundaria
// explicita ni una asignacion persistida por un lote anterior.
export function assignOrders(plan: Outcome[], previous: Assignment[], occupied: OccupiedSlot[], catalogAvailable: boolean): Assignment[] {
  const byFile = new Map(previous.map(entry => [entry.file, entry]));
  const used = new Map<string, Set<number>>();
  const slotsFor = (id: string) => {
    let slots = used.get(id);
    if (!slots) { slots = new Set(); used.set(id, slots); }
    return slots;
  };
  for (const entry of previous) slotsFor(entry.idItem).add(entry.order);
  for (const entry of occupied) slotsFor(entry.id_item).add(entry.orden);
  const candidates = plan.filter(row => row.image && ["ready", "catalogUnavailable", "duplicate"].includes(row.status))
    .sort((a, b) => {
      // Original sin extension primero; desempate estable por ruta, sin locale.
      const rank = (file: string) => /\.[^.\\/]+$/.test(file) ? 1 : 0;
      return rank(a.file) - rank(b.file) || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
    });
  const displaced: Outcome[] = [];
  const apply = (row: Outcome, entry: Assignment) => {
    const requested = row.image!.order;
    row.image = { idItem: entry.idItem, order: entry.order, storagePath: entry.storagePath };
    row.status = catalogAvailable ? "ready" : "catalogUnavailable";
    row.detail = requested === entry.order ? undefined : `Orden solicitado ${requested} ocupado; imagen conservada en orden ${entry.order}.`;
    row.reassigned = requested !== entry.order;
    byFile.set(entry.file, entry);
    slotsFor(entry.idItem).add(entry.order);
  };
  for (const row of candidates) {
    const old = byFile.get(row.file);
    if (old) {
      if (old.idItem !== row.image!.idItem) {
        row.status = "blocked";
        row.detail = "La asignacion anterior difiere del ID real validado; requiere revision.";
      } else apply(row, old);
      continue;
    }
    if (slotsFor(row.image!.idItem).has(row.image!.order)) displaced.push(row);
    else apply(row, { ...row.image!, file: row.file });
  }
  for (const row of displaced) {
    const id = row.image!.idItem;
    const slots = slotsFor(id);
    let order = 2;
    while (slots.has(order)) order++;
    if (order > 2147483647) throw new Error(`No hay orden disponible para ${id}.`);
    apply(row, { file: row.file, idItem: id, order, storagePath: objectPath(id, order) });
  }
  return [...byFile.values()].sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
}

export async function saveAssignments(root: string, projectUrl: string, assignments: Assignment[]) {
  const directory = join(root, ".fotos-import-state");
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `assignments-${randomUUID()}.tmp`);
  const handle = await open(temporary, "wx");
  try {
    await handle.writeFile(JSON.stringify({ version: 1, projectUrl, assignments }, null, 2));
    await handle.sync();
  } finally { await handle.close(); }
  try { await rename(temporary, join(directory, "assignments.json")); }
  catch (error) { await unlink(temporary).catch(() => undefined); throw error; }
}
