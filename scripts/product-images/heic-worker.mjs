import { parentPort, workerData } from "node:worker_threads";
import { createRequire } from "node:module";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const heif = require("libheif-js/wasm-bundle");
let images = [];
try {
  images = new heif.HeifDecoder().decode(workerData);
  if (images.length !== 1) throw new Error("HEIC debe contener una sola imagen principal decodificable.");
  const image = images[0];
  const width = image.get_width();
  const height = image.get_height();
  if (!Number.isSafeInteger(width * height) || width < 1 || height < 1 || width * height > 40_000_000) {
    throw new Error("HEIC supera el limite de 40 megapixeles.");
  }
  const pixels = await new Promise((resolve, reject) => {
    image.display({ data: new Uint8ClampedArray(width * height * 4), width, height }, result => {
      if (!result) reject(new Error("No se pudo decodificar HEIC completo."));
      else resolve(result);
    });
  });
  // libheif aplica la rotacion/espejo del contenedor. No se aplica una segunda
  // orientacion EXIF a los pixeles ya orientados. Sharp elimina los metadatos.
  const result = await sharp(Buffer.from(pixels.data.buffer), { raw: { width, height, channels: 4 } })
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  const data = new Uint8Array(result.data);
  parentPort.postMessage({ data, info: result.info, sourceFormat: "heic" }, [data.buffer]);
} catch (error) {
  parentPort.postMessage({ error: error instanceof Error ? error.message : "Fallo HEIC" });
} finally {
  for (const image of images) image.free();
}
