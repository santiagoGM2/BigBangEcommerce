/** Evita que datos externos cierren el elemento script del JSON-LD. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
