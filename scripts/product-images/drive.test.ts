import assert from "node:assert/strict";
import { test } from "node:test";
import { downloadDriveImage, driveFolderId, listDriveImages } from "./drive";

test("Drive lista paginas y subcarpetas sin perder archivos con el mismo nombre", async () => {
  const calls: URL[] = [];
  const fetcher = async (input: string) => {
    const url = new URL(input);
    calls.push(url);
    if (url.pathname.endsWith("/files/folder123456")) {
      return Response.json({ id: "folder123456", mimeType: "application/vnd.google-apps.folder" });
    }
    const query = url.searchParams.get("q");
    if (query === "'folder123456' in parents and trashed = false" && !url.searchParams.has("pageToken")) {
      return Response.json({ nextPageToken: "next", files: [
        { id: "a", name: "14325.png", mimeType: "image/png", size: "20" },
        { id: "sub", name: "secundarias", mimeType: "application/vnd.google-apps.folder" },
      ] });
    }
    if (url.searchParams.get("pageToken") === "next") {
      return Response.json({ files: [{ id: "b", name: "14325.png", mimeType: "image/png", size: "20" }] });
    }
    if (query === "'sub' in parents and trashed = false") {
      return Response.json({ files: [{ id: "c", name: "14325-1.jpg", mimeType: "image/jpeg", size: "10" }] });
    }
    throw new Error(`Solicitud inesperada: ${url}`);
  };
  const files = await listDriveImages(fetcher, "https://drive.google.com/drive/u/1/folders/folder123456");
  assert.deepEqual(files.map(file => [file.id, file.relativePath]), [
    ["a", "14325.png"], ["b", "14325.png"], ["c", "secundarias/14325-1.jpg"],
  ]);
  assert.equal(calls.length, 4);
  assert.ok(calls.every(url => url.searchParams.get("supportsAllDrives") === "true"));
  assert.ok(calls.filter(url => url.pathname.endsWith("/files")).every(url => url.searchParams.get("includeItemsFromAllDrives") === "true"));
});

test("Drive rechaza listados incompletos y carpetas inaccesibles", async () => {
  const root = { id: "folder123456", mimeType: "application/vnd.google-apps.folder" };
  await assert.rejects(listDriveImages(async url =>
    Response.json(url.includes("/files/folder123456") ? root : { incompleteSearch: true, files: [] }),
  "folder123456"), /lista incompleta/);
  await assert.rejects(listDriveImages(async () => new Response("", { status: 403 }), "folder123456"), /HTTP 403/);
});

test("Drive limita la descarga y conserva bytes sin modificar", async () => {
  const file = { id: "abc", name: "000480", mimeType: "image/jpeg", size: "4", relativePath: "000480" };
  const bytes = await downloadDriveImage(async url => {
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("alt"), "media");
    return new Response(new Uint8Array([1, 2, 3, 4]));
  }, file);
  assert.deepEqual(bytes, Buffer.from([1, 2, 3, 4]));
  await assert.rejects(downloadDriveImage(async () => { throw new Error("No debe descargar"); },
    { ...file, size: String(41 * 1024 * 1024) }), /40 MiB/);
  assert.equal(driveFolderId("folder123456"), "folder123456");
  assert.throws(() => driveFolderId(""), /invalido/);
});
