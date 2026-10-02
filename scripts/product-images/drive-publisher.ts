import { createHash } from "node:crypto";
import type { ImageName } from "./core";

export type DriveSource = {
  source_key: string; id_item: string; orden: number; source_name: string;
  observed_version: string; published_version: string | null; published_url: string | null;
};
export type DriveAttempt = {
  source_key: string; source_version: string; sha256: string; storage_path: string;
  uploaded_at: string | null; completed_at: string | null; last_error: string | null;
};

export function driveObjectPath(sourceKey: string, image: ImageName, sha256: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(sourceKey) || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error("Identidad o checksum invalido.");
  return `drive/${sourceKey}/${sha256}/${image.storagePath}`;
}

export interface DrivePublishEffects {
  assertLease(): Promise<void>;
  prepare(source: DriveSource, sha256: string, path: string): Promise<DriveAttempt>;
  upload(path: string, bytes: Buffer): Promise<string>;
  confirmUpload(source: DriveSource, sha256: string): Promise<void>;
  complete(source: DriveSource, sha256: string, url: string): Promise<DriveSource>;
}

// El objeto depende del contenido. La version anterior sigue intacta si falla
// la BD, y el intento persistido permite encontrar/reintentar el objeto nuevo.
export async function publishDriveImage(source: DriveSource, bytes: Buffer, effects: DrivePublishEffects) {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const image = { idItem: source.id_item, order: source.orden,
    storagePath: `${source.id_item}${source.orden === 1 ? "" : `-${source.orden - 1}`}.webp` };
  const path = driveObjectPath(source.source_key, image, sha256);
  await effects.assertLease();
  const attempt = await effects.prepare(source, sha256, path);
  if (attempt.storage_path !== path || attempt.sha256 !== sha256 || attempt.source_version !== source.observed_version) {
    throw new Error("El diario no confirmo el destino esperado.");
  }
  await effects.assertLease();
  const url = await effects.upload(path, bytes);
  await effects.confirmUpload(source, sha256);
  const complete = await effects.complete(source, sha256, url);
  if (complete.source_key !== source.source_key || complete.orden !== source.orden ||
    complete.id_item !== source.id_item || complete.published_version !== source.observed_version || complete.published_url !== url) {
    throw new Error("La BD no confirmo la publicacion; el intento se conciliara en la proxima ejecucion.");
  }
  return { url, path, sha256 };
}
