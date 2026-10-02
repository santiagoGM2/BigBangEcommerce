// Reglas TypeScript de Next para el CLI, sin cargar plugins React (no hay JSX).
// La configuracion global heredada se audita por separado; no se modifica aqui.
import nextTypescript from "eslint-config-next/typescript";

const config = [...nextTypescript];
export default config;
