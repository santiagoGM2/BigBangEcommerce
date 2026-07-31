/**
 * Genera los 14 SVG placeholders de familia en public/catalogo/placeholders/.
 * Se corre con: pnpm gen:placeholders
 *
 * Diseño: plano, geometrico, sin degradados. Fondo solido con el color de
 * marca de la familia (roto entre rosa, verde y morado), silueta blanca del
 * icono y nombre de la familia abajo en Nunito 900. Legible desde ~200px
 * de ancho hasta tamano de detalle.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FAMILIAS, type FamiliaSlug } from "../lib/catalogo/familias-meta.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const OUT_DIR = join(REPO_ROOT, "public", "catalogo", "placeholders");

const ROSA = "#E91E8C";
const VERDE = "#7DC720";
const MORADO = "#3D1A6E";

// Color por familia — pensado para que familias semanticamente cercanas
// contrasten y no se acumule mucho de un mismo color en pantalla.
const COLOR: Record<FamiliaSlug, string> = {
  juguetes: ROSA,
  "decoracion-fiestas": VERDE,
  "disfraces-y-halloween": MORADO,
  "dulceria-y-snacks": ROSA,
  "regalos-y-detalles": VERDE,
  pinateria: ROSA,
  peluches: MORADO,
  escolar: VERDE,
  "cosmeticos-y-cuidado-personal": ROSA,
  navidad: VERDE,
  "moda-y-accesorios": MORADO,
  "hogar-y-variedades": VERDE,
  "tecnologia-y-electronica": MORADO,
  bebes: ROSA,
};

/**
 * Iconos geometricos, todos con paths blancos sobre un lienzo virtual de
 * 200x200 centrado en (200, 170) en el SVG final de 400x400.
 * Ninguno usa stroke fino — todo relleno solido para que se lea claro.
 */
const ICON: Record<FamiliaSlug, string> = {
  // Pelota con dos meridianos
  juguetes: `
    <circle cx="200" cy="170" r="70" fill="#fff"/>
    <path d="M130,170 Q200,120 270,170" fill="none" stroke="${ROSA}" stroke-width="10"/>
    <path d="M130,170 Q200,220 270,170" fill="none" stroke="${ROSA}" stroke-width="10"/>
    <line x1="200" y1="100" x2="200" y2="240" stroke="${ROSA}" stroke-width="10"/>
  `,
  // Gorro de fiesta (triangulo) con pompon y confeti
  "decoracion-fiestas": `
    <polygon points="200,90 155,230 245,230" fill="#fff"/>
    <circle cx="200" cy="82" r="14" fill="#fff"/>
    <circle cx="120" cy="130" r="8" fill="#fff"/>
    <circle cx="280" cy="140" r="6" fill="#fff"/>
    <circle cx="120" cy="220" r="6" fill="#fff"/>
    <circle cx="290" cy="215" r="8" fill="#fff"/>
    <rect x="180" y="150" width="12" height="12" fill="${VERDE}"/>
    <rect x="205" y="180" width="12" height="12" fill="${VERDE}"/>
  `,
  // Mascara de antifaz
  "disfraces-y-halloween": `
    <path d="M120,150 Q120,110 200,110 Q280,110 280,150 Q280,200 240,210 Q220,215 200,195 Q180,215 160,210 Q120,200 120,150 Z" fill="#fff"/>
    <circle cx="165" cy="160" r="14" fill="${MORADO}"/>
    <circle cx="235" cy="160" r="14" fill="${MORADO}"/>
  `,
  // Paleta
  "dulceria-y-snacks": `
    <circle cx="200" cy="140" r="65" fill="#fff"/>
    <circle cx="200" cy="140" r="45" fill="none" stroke="${ROSA}" stroke-width="8"/>
    <circle cx="200" cy="140" r="25" fill="none" stroke="${ROSA}" stroke-width="8"/>
    <rect x="192" y="200" width="16" height="55" fill="#fff"/>
  `,
  // Caja de regalo con cinta
  "regalos-y-detalles": `
    <rect x="130" y="130" width="140" height="110" fill="#fff"/>
    <rect x="120" y="118" width="160" height="24" fill="#fff"/>
    <rect x="192" y="118" width="16" height="122" fill="${VERDE}"/>
    <path d="M200,118 C170,100 150,60 200,90 C250,60 230,100 200,118 Z" fill="#fff"/>
  `,
  // Globo con hilo
  pinateria: `
    <ellipse cx="200" cy="150" rx="58" ry="72" fill="#fff"/>
    <polygon points="192,222 208,222 200,238" fill="#fff"/>
    <path d="M200,238 Q210,255 195,270 Q210,285 195,300" fill="none" stroke="#fff" stroke-width="4"/>
    <ellipse cx="185" cy="130" rx="10" ry="16" fill="${ROSA}" opacity="0.35"/>
  `,
  // Osito
  peluches: `
    <circle cx="200" cy="170" r="60" fill="#fff"/>
    <circle cx="155" cy="120" r="22" fill="#fff"/>
    <circle cx="245" cy="120" r="22" fill="#fff"/>
    <circle cx="155" cy="120" r="10" fill="${MORADO}"/>
    <circle cx="245" cy="120" r="10" fill="${MORADO}"/>
    <circle cx="180" cy="160" r="7" fill="${MORADO}"/>
    <circle cx="220" cy="160" r="7" fill="${MORADO}"/>
    <ellipse cx="200" cy="185" rx="10" ry="7" fill="${MORADO}"/>
  `,
  // Lapiz
  escolar: `
    <polygon points="120,220 155,220 155,140 165,120 145,110 137,130 137,220" fill="#fff"/>
    <rect x="137" y="145" width="18" height="14" fill="${VERDE}"/>
    <polygon points="137,220 155,220 146,240" fill="#fff"/>
    <rect x="180" y="130" width="90" height="16" fill="#fff"/>
    <rect x="180" y="160" width="70" height="12" fill="#fff"/>
    <rect x="180" y="188" width="80" height="12" fill="#fff"/>
  `,
  // Labial
  "cosmeticos-y-cuidado-personal": `
    <rect x="170" y="180" width="60" height="70" fill="#fff"/>
    <rect x="160" y="170" width="80" height="18" fill="#fff"/>
    <polygon points="180,170 220,170 210,90 190,90" fill="#fff"/>
    <polygon points="180,170 220,170 210,80" fill="${ROSA}"/>
  `,
  // Arbol de navidad
  navidad: `
    <polygon points="200,80 240,150 220,150 260,215 165,215 205,150 160,150" fill="#fff"/>
    <rect x="188" y="215" width="24" height="26" fill="#fff"/>
    <polygon points="200,64 208,76 220,80 208,84 200,96 192,84 180,80 192,76" fill="#fff"/>
  `,
  // Bolso
  "moda-y-accesorios": `
    <path d="M155,150 Q155,110 200,110 Q245,110 245,150" fill="none" stroke="#fff" stroke-width="12"/>
    <path d="M130,150 L270,150 L255,250 L145,250 Z" fill="#fff"/>
    <circle cx="200" cy="200" r="10" fill="${MORADO}"/>
  `,
  // Casa
  "hogar-y-variedades": `
    <polygon points="200,90 110,175 130,175 130,250 270,250 270,175 290,175" fill="#fff"/>
    <rect x="185" y="195" width="30" height="55" fill="${VERDE}"/>
    <rect x="145" y="185" width="26" height="26" fill="${VERDE}"/>
    <rect x="230" y="185" width="26" height="26" fill="${VERDE}"/>
  `,
  // Audifonos
  "tecnologia-y-electronica": `
    <path d="M120,180 Q120,110 200,110 Q280,110 280,180" fill="none" stroke="#fff" stroke-width="14"/>
    <rect x="110" y="175" width="34" height="60" rx="10" fill="#fff"/>
    <rect x="256" y="175" width="34" height="60" rx="10" fill="#fff"/>
  `,
  // Chupo
  bebes: `
    <ellipse cx="200" cy="170" rx="50" ry="38" fill="#fff"/>
    <rect x="180" y="200" width="40" height="20" rx="6" fill="#fff"/>
    <ellipse cx="200" cy="240" rx="20" ry="16" fill="#fff"/>
  `,
};

// Ancho maximo para el texto del nombre. 360 = 400 (viewport) - 40 (margen
// 20px por lado). Solo aplica cuando el nombre naturalmente supera ese
// ancho; los nombres cortos se dejan renderizar sin compresion para que
// no queden con las letras artificialmente apretadas.
const NOMBRE_MAX_WIDTH = 360;

// Umbral en caracteres a partir del cual asumimos que el nombre no cabe
// naturalmente a font-size 30 con letter-spacing 1. Calibrado midiendo
// los 14 nombres reales: >14 chars = necesita compresion.
const NOMBRE_UMBRAL_CHARS = 14;

function buildSvg(slug: FamiliaSlug, nombre: string): string {
  const fondo = COLOR[slug];
  const icono = ICON[slug].trim();
  const upper = nombre.toUpperCase();
  // Solo comprimimos los nombres que realmente no caben. Aplicar textLength
  // parejo a los 14 estiraba/apretaba los cortos (PIÑATERIA, ESCOLAR, BEBES)
  // sin razon y se veian distorsionados.
  const necesitaCompresion = upper.length > NOMBRE_UMBRAL_CHARS;
  const attrsCompresion = necesitaCompresion
    ? ` textLength="${NOMBRE_MAX_WIDTH}" lengthAdjust="spacingAndGlyphs"`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="${escapeAttr(nombre)}">
  <rect width="400" height="400" fill="${fondo}"/>
  ${icono}
  <text x="200" y="342" text-anchor="middle" fill="#ffffff"
        font-family="Nunito, system-ui, sans-serif" font-weight="900"
        font-size="30" letter-spacing="1"${attrsCompresion}>${escapeText(upper)}</text>
  <text x="200" y="374" text-anchor="middle" fill="#ffffff"
        font-family="Nunito, system-ui, sans-serif" font-weight="700"
        font-size="14" letter-spacing="3" opacity="0.7">BIG BANG</text>
</svg>
`;
}

/**
 * Version SIN texto: solo fondo de color + icono blanco centrado. Se usa
 * en la seccion "Categorias" de la landing, donde el nombre va debajo del
 * thumb como texto HTML normal (asi no hay que preocuparse por overflow
 * ni por doble aparicion del nombre).
 */
function buildIconOnlySvg(slug: FamiliaSlug, nombre: string): string {
  const fondo = COLOR[slug];
  const icono = ICON[slug].trim();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="${escapeAttr(nombre)}">
  <rect width="400" height="400" fill="${fondo}"/>
  ${icono}
</svg>
`;
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}

mkdirSync(OUT_DIR, { recursive: true });
for (const f of FAMILIAS) {
  writeFileSync(join(OUT_DIR, `${f.slug}.svg`), buildSvg(f.slug, f.nombre), "utf8");
  writeFileSync(
    join(OUT_DIR, `${f.slug}-icon.svg`),
    buildIconOnlySvg(f.slug, f.nombre),
    "utf8",
  );
}
console.log(
  `[generate-placeholders] ${FAMILIAS.length * 2} SVG escritos (${FAMILIAS.length} full + ${FAMILIAS.length} icon-only) en ${OUT_DIR}`,
);
