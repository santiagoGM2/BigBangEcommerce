import { Worker } from "node:worker_threads";
import type { OutputInfo } from "sharp";

let active = 0;
const queue: (() => void)[] = [];

// Maximo dos decodificadores HEIC dentro del limite global de cinco archivos.
// Worker sin variables de entorno del proceso (no recibe claves), con timeout;
// cada imagen libera su memoria WASM al terminar, incluso si falla.
export async function optimizeHeic(source: Buffer): Promise<{ data: Buffer; info: OutputInfo; sourceFormat: string }> {
  if (source.length > 32 * 1024 * 1024) throw new Error("HEIC supera el limite de 32 MB.");
  if (active >= 2) await new Promise<void>(resolve => queue.push(resolve));
  else active++;
  try {
    return await new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./heic-worker.mjs", import.meta.url), {
        workerData: source, execArgv: [], env: {}, stdout: true, stderr: true,
        resourceLimits: { maxOldGenerationSizeMb: 128 },
      });
      // Los logs del codec no se mezclan con el reporte. Los errores se reciben
      // por el canal tipado; no se rebajan limites internos del decodificador.
      worker.stdout.resume(); worker.stderr.resume();
      let done = false;
      const finish = (error?: Error, result?: { data: Uint8Array; info: OutputInfo; sourceFormat: string }) => {
        if (done) return;
        done = true; clearTimeout(timer);
        void worker.terminate().then(() => {
          if (error) reject(error);
          else resolve({ ...result!, data: Buffer.from(result!.data) });
        }, reject);
      };
      const timer = setTimeout(() => finish(new Error("HEIC excedio 30 segundos de procesamiento.")), 30_000);
      worker.once("message", (result: { error?: string; data: Uint8Array; info: OutputInfo; sourceFormat: string }) => {
        finish(result.error ? new Error(result.error) : undefined, result);
      });
      worker.once("error", error => finish(error));
      worker.once("exit", code => { if (!done) finish(new Error(`HEIC termino sin resultado (codigo ${code}).`)); });
    });
  } finally {
    const next = queue.shift();
    if (next) next(); else active--;
  }
}
