import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

/**
 * Renderer minimalista de markdown para los documentos legales de
 * `_data/legal/*.md`. Soporta lo justo que aparece en esos textos:
 *
 *   - Encabezados #, ##
 *   - Blockquotes con "> "
 *   - Listas con "- "
 *   - Parrafos
 *   - Negritas con **texto**
 *   - Enlaces [texto](url)  (los que empiezan con "/" se renderizan con
 *     next/link para navegacion cliente)
 *   - Placeholders [pendiente: ...] se muestran destacados en amarillo
 *     tenue para que el revisor legal los detecte facilmente.
 *
 * NO instalamos react-markdown / remark: solo son 2 docs de estructura
 * predecible y el parser cabe en <100 lineas.
 */

interface LegalDocumentProps {
  markdown: string;
  /** Fecha de "ultima actualizacion" mostrada en el header. */
  fechaActualizacion: string;
  /** Aviso opcional que aparece antes del H1 (ej: "Este es un borrador..."). */
  disclaimer?: ReactNode;
}

export function LegalDocument({
  markdown,
  fechaActualizacion,
  disclaimer,
}: LegalDocumentProps) {
  const blocks = parseMarkdown(markdown);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {disclaimer && (
        <div className="mb-8 rounded-xl border-l-4 border-morado bg-morado/5 p-4 text-sm text-tinta/80">
          {disclaimer}
        </div>
      )}
      <article className="bb-legal">
        {blocks.map((b, i) => renderBlock(b, i))}
        <p className="mt-10 text-xs text-tinta/50">
          Última actualización: <strong>{fechaActualizacion}</strong>
        </p>
      </article>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

type Block =
  | { kind: "h1" | "h2"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "quote"; text: string };

function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  let buffer: string[] = [];
  let bufferKind: "p" | "ul" | "quote" | null = null;

  function flush() {
    if (bufferKind === null || buffer.length === 0) {
      buffer = [];
      bufferKind = null;
      return;
    }
    if (bufferKind === "p") {
      blocks.push({ kind: "p", text: buffer.join(" ") });
    } else if (bufferKind === "ul") {
      blocks.push({ kind: "ul", items: [...buffer] });
    } else if (bufferKind === "quote") {
      blocks.push({ kind: "quote", text: buffer.join(" ") });
    }
    buffer = [];
    bufferKind = null;
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line === "") {
      flush();
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      blocks.push({ kind: "h2", text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith("# ")) {
      flush();
      blocks.push({ kind: "h1", text: line.slice(2).trim() });
      continue;
    }
    if (line.startsWith("> ")) {
      if (bufferKind !== "quote") flush();
      bufferKind = "quote";
      buffer.push(line.slice(2).trim());
      continue;
    }
    if (line.startsWith("- ")) {
      if (bufferKind !== "ul") flush();
      bufferKind = "ul";
      buffer.push(line.slice(2).trim());
      continue;
    }
    // Continuacion de un item de lista (dos espacios de indentacion)
    if (bufferKind === "ul" && /^\s{2,}/.test(raw)) {
      const last = buffer.length - 1;
      buffer[last] = `${buffer[last]} ${line.trim()}`;
      continue;
    }
    // Parrafo (o continuacion de parrafo)
    if (bufferKind !== "p") flush();
    bufferKind = "p";
    buffer.push(line);
  }
  flush();

  return blocks;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderBlock(b: Block, i: number): ReactElement {
  switch (b.kind) {
    case "h1":
      return (
        <h1 key={i} className="mb-6 text-3xl font-black text-tinta sm:text-4xl">
          {renderInline(b.text)}
        </h1>
      );
    case "h2":
      return (
        <h2
          key={i}
          className="mt-10 mb-3 text-xl font-black text-morado sm:text-2xl"
        >
          {renderInline(b.text)}
        </h2>
      );
    case "p":
      return (
        <p key={i} className="mb-4 text-tinta/80 leading-relaxed">
          {renderInline(b.text)}
        </p>
      );
    case "ul":
      return (
        <ul key={i} className="mb-4 space-y-2 pl-5 text-tinta/80">
          {b.items.map((it, j) => (
            <li key={j} className="list-disc leading-relaxed marker:text-rosa">
              {renderInline(it)}
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote
          key={i}
          className="mb-6 rounded-r-lg border-l-4 border-verde bg-verde/5 py-3 pl-4 pr-3 text-sm text-tinta/70 italic"
        >
          {renderInline(b.text)}
        </blockquote>
      );
  }
}

/**
 * Inline rendering. Maneja **bold**, [text](url) y resalta los tokens
 * "[pendiente: ...]" y "[pendiente...]" que el borrador deja para revision
 * legal. Se procesa por regex secuencial: extraemos matches ordenados por
 * posicion y armamos el arreglo React alternando fragmentos y elementos.
 */
function renderInline(text: string): ReactNode[] {
  type Token = { start: number; end: number; node: ReactNode; kind: string };
  const tokens: Token[] = [];

  // [pendiente: ...] y [pendiente ...]
  for (const m of text.matchAll(/\[pendiente[^\]]*\]/gi)) {
    tokens.push({
      start: m.index!,
      end: m.index! + m[0].length,
      kind: "pending",
      node: (
        <mark
          key={`p-${m.index}`}
          className="rounded bg-yellow-200/70 px-1 text-xs font-bold text-yellow-900"
        >
          {m[0]}
        </mark>
      ),
    });
  }
  // [text](url) — evitar chocar con los [pendiente ...] anteriores
  for (const m of text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    // Si el texto es "[pendiente ...]" ya lo procesamos como pending
    if (/^pendiente/i.test(m[1]!)) continue;
    const [full, label, url] = m;
    const isInternal = url!.startsWith("/");
    tokens.push({
      start: m.index!,
      end: m.index! + full.length,
      kind: "link",
      node: isInternal ? (
        <Link
          key={`l-${m.index}`}
          href={url!}
          className="text-rosa underline hover:text-morado"
        >
          {label}
        </Link>
      ) : (
        <a
          key={`l-${m.index}`}
          href={url!}
          target="_blank"
          rel="noopener"
          className="text-rosa underline hover:text-morado"
        >
          {label}
        </a>
      ),
    });
  }
  // **bold**
  for (const m of text.matchAll(/\*\*([^*]+)\*\*/g)) {
    tokens.push({
      start: m.index!,
      end: m.index! + m[0].length,
      kind: "bold",
      node: (
        <strong key={`b-${m.index}`} className="font-bold text-tinta">
          {m[1]}
        </strong>
      ),
    });
  }

  tokens.sort((a, b) => a.start - b.start);

  const result: ReactNode[] = [];
  let cursor = 0;
  for (const t of tokens) {
    if (t.start < cursor) continue; // colisiones -> ignorar
    if (t.start > cursor) result.push(text.slice(cursor, t.start));
    result.push(t.node);
    cursor = t.end;
  }
  if (cursor < text.length) result.push(text.slice(cursor));
  return result;
}
