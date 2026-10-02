import { GoogleAuth } from "google-auth-library";

const API_BASE = "https://www.googleapis.com/drive/v3";
const READ_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const MAX_DOWNLOAD_BYTES = 40 * 1024 * 1024;

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  md5Checksum?: string;
  version?: string;
  modifiedTime?: string;
  driveId?: string;
  relativePath: string;
};

type FileList = { nextPageToken?: string; files?: Omit<DriveFile, "relativePath">[]; incompleteSearch?: boolean };
type DriveFetch = (url: string, init: RequestInit) => Promise<Response>;

export function driveFolderId(value: string): string {
  const trimmed = value.trim();
  const match = /(?:^|\/)folders\/([a-zA-Z0-9_-]+)(?:[/?#]|$)/.exec(trimmed);
  const id = match?.[1] ?? trimmed;
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(id)) throw new Error("ID de carpeta de Drive invalido.");
  return id;
}

export async function createDriveFetch(): Promise<DriveFetch> {
  const auth = new GoogleAuth({ scopes: [READ_SCOPE] });
  const client = await auth.getClient();
  return async (url, init) => {
    const token = await client.getAccessToken();
    if (!token.token) throw new Error("Google no entrego un token de acceso.");
    return fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token.token}` } });
  };
}

async function request(fetcher: DriveFetch, url: URL): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetcher(url.toString(), { signal: AbortSignal.timeout(30_000) });
    if (response.ok) return response;
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) {
      throw new Error(`Drive API respondio HTTP ${response.status} en ${url.pathname}.`);
    }
    // Espera acotada para cuotas y fallos transitorios; no imprime tokens.
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 5_000) : 500 * 2 ** attempt;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error("Drive API no respondio correctamente.");
}

export async function listDriveImages(fetcher: DriveFetch, rootId: string): Promise<DriveFile[]> {
  const id = driveFolderId(rootId);
  const metadataUrl = new URL(`${API_BASE}/files/${id}`);
  metadataUrl.searchParams.set("fields", "id,name,mimeType,driveId");
  metadataUrl.searchParams.set("supportsAllDrives", "true");
  const root = await (await request(fetcher, metadataUrl)).json() as { id?: string; mimeType?: string };
  if (root.id !== id || root.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("La carpeta de Drive no existe o no es accesible para esta cuenta.");
  }
  const folders = [{ id, path: "" }];
  const visited = new Set<string>();
  const files: DriveFile[] = [];
  while (folders.length) {
    const folder = folders.shift()!;
    if (visited.has(folder.id)) continue;
    visited.add(folder.id);
    if (visited.size > 1_000) throw new Error("Demasiadas subcarpetas de Drive; revisar el alcance.");
    let pageToken: string | undefined;
    do {
      const url = new URL(`${API_BASE}/files`);
      url.searchParams.set("q", `'${folder.id}' in parents and trashed = false`);
      url.searchParams.set("fields", "nextPageToken,incompleteSearch,files(id,name,mimeType,size,md5Checksum,version,modifiedTime,driveId)");
      url.searchParams.set("pageSize", "1000");
      url.searchParams.set("supportsAllDrives", "true");
      url.searchParams.set("includeItemsFromAllDrives", "true");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const response = await request(fetcher, url);
      const result = await response.json() as FileList;
      if (result.incompleteSearch || !Array.isArray(result.files)) {
        throw new Error("Drive devolvio una lista incompleta; no se procesa el lote.");
      }
      for (const file of result.files) {
        if (!/^[A-Za-z0-9_-]+$/.test(file.id) || !file.name || !file.mimeType) throw new Error("Drive devolvio metadatos incompletos o un ID invalido.");
        const relativePath = `${folder.path}${file.name}`;
        if (file.mimeType === "application/vnd.google-apps.folder") {
          folders.push({ id: file.id, path: `${relativePath}/` });
        } else {
          files.push({ ...file, relativePath });
        }
      }
      pageToken = result.nextPageToken;
    } while (pageToken);
  }
  return files.sort((a, b) => a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export async function downloadDriveImage(fetcher: DriveFetch, file: DriveFile): Promise<Buffer> {
  if (!/^\d+$/.test(file.size ?? "") || Number(file.size) > MAX_DOWNLOAD_BYTES) {
    throw new Error("Tamano desconocido o superior al limite de descarga de 40 MiB.");
  }
  const url = new URL(`${API_BASE}/files/${encodeURIComponent(file.id)}`);
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");
  const response = await request(fetcher, url);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Drive devolvio una descarga sin contenido.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_DOWNLOAD_BYTES) throw new Error("Descarga de Drive excedio 40 MiB.");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  return Buffer.concat(chunks, bytes);
}
