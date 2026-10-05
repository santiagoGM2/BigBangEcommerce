import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { optimizeImageBytes } from "./core";
import { classifyImageDecodeError, InvalidImageContentError } from "./image-validation";

test("JPEG con cabecera corrupta se rechaza; una imagen sana del lote sigue optimizándose", async () => {
  const invalid = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const valid = await sharp({ create: { width: 24, height: 16, channels: 3, background: "blue" } }).jpeg().toBuffer();
  const results = await Promise.allSettled([optimizeImageBytes(invalid), optimizeImageBytes(valid)]);
  assert.equal(results[0].status, "rejected");
  if (results[0].status === "rejected") assert.ok(results[0].reason instanceof InvalidImageContentError);
  assert.equal(results[1].status, "fulfilled");
  if (results[1].status === "fulfilled") assert.equal(results[1].value.info.format, "webp");
});

test("Huffman corrupto observado en producción requiere reemplazo del archivo", () => {
  const error = classifyImageDecodeError(new Error("VipsJpeg: Corrupt JPEG data: bad Huffman code"));
  assert.ok(error instanceof InvalidImageContentError);
  assert.match(error.message, /bad Huffman code/);
});

test("No se ocultan fallos de red, checksum, disco, memoria ni codec desconocido", () => {
  for (const message of ["fetch failed", "Drive API respondio HTTP 503", "checksum incorrecto", "ENOSPC", "ENOMEM", "HEIC excedio 30 segundos de procesamiento.", "Unknown decoder failure",
    "Input buffer has corrupt header: out of memory", "Input buffer has corrupt header: Unknown decoder failure",
    "Input buffer has corrupt header: VipsJpeg: premature end of JPEG image\nENOMEM"]) {
    const error = new Error(message);
    assert.equal(classifyImageDecodeError(error), error);
    assert.ok(!(error instanceof InvalidImageContentError));
  }
});
