// Solo errores inequívocos del contenido pasan a revisión manual. Un fallo de
// red, memoria, disco o ejecución del codec sigue siendo un error operativo.
export class InvalidImageContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidImageContentError";
  }
}

export function classifyImageDecodeError(error: unknown): unknown {
  if (error instanceof InvalidImageContentError) return error;
  if (!(error instanceof Error)) return error;
  // Sharp también usa «corrupt header» para errores internos: se exige que
  // TODAS las líneas sean diagnósticos de contenido conocidos.
  const diagnostics = error.message.replace(/^Input buffer has corrupt header: /, "").split(/\r?\n/);
  const corruptJpeg = diagnostics.every(line =>
    /^VipsJpeg: (Corrupt JPEG data: bad Huffman code|premature end of JPEG image|JPEG datastream contains no image)$/.test(line));
  if (corruptJpeg || error.message === "Input buffer contains unsupported image format") {
    return new InvalidImageContentError(error.message);
  }
  return error;
}
