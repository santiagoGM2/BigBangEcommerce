import Link from "next/link";

interface PaginacionProps {
  paginaActual: number;
  totalPaginas: number;
  /** Ruta base sin query string. `page=1` va a esta ruta pelada (URL canonica). */
  basePath: string;
}

// Genera la lista de "botones" a mostrar. Con muchas paginas usa ellipsis
// tipo Google: 1 ... 4 5 [6] 7 8 ... 100.
function computarBotones(actual: number, total: number): (number | "…")[] {
  const rango: (number | "…")[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) rango.push(i);
    return rango;
  }
  const ventana = new Set<number>([1, total, actual - 1, actual, actual + 1]);
  const ordenados = [...ventana].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  for (let i = 0; i < ordenados.length; i++) {
    const n = ordenados[i]!;
    rango.push(n);
    const siguiente = ordenados[i + 1];
    if (siguiente !== undefined && siguiente - n > 1) {
      rango.push("…");
    }
  }
  return rango;
}

function hrefFor(base: string, page: number): string {
  return page === 1 ? base : `${base}?page=${page}`;
}

export function Paginacion({ paginaActual, totalPaginas, basePath }: PaginacionProps) {
  if (totalPaginas <= 1) return null;

  const botones = computarBotones(paginaActual, totalPaginas);
  const prevDisabled = paginaActual <= 1;
  const nextDisabled = paginaActual >= totalPaginas;

  return (
    <nav
      className="mt-8 flex items-center justify-center gap-2"
      aria-label="Paginación"
    >
      <PagLink
        href={hrefFor(basePath, paginaActual - 1)}
        disabled={prevDisabled}
        rel="prev"
        ariaLabel="Página anterior"
      >
        ‹
      </PagLink>

      {botones.map((b, i) =>
        b === "…" ? (
          <span key={`e-${i}`} className="px-2 text-tinta/40">
            …
          </span>
        ) : (
          <PagLink
            key={b}
            href={hrefFor(basePath, b)}
            active={b === paginaActual}
            ariaLabel={`Ir a la página ${b}`}
          >
            {b}
          </PagLink>
        ),
      )}

      <PagLink
        href={hrefFor(basePath, paginaActual + 1)}
        disabled={nextDisabled}
        rel="next"
        ariaLabel="Página siguiente"
      >
        ›
      </PagLink>
    </nav>
  );
}

interface PagLinkProps {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  rel?: "prev" | "next";
  ariaLabel: string;
}

function PagLink({ href, children, active, disabled, rel, ariaLabel }: PagLinkProps) {
  const base =
    "flex h-10 min-w-[2.5rem] items-center justify-center rounded-lg px-3 text-sm font-bold transition";
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={`${base} cursor-not-allowed border border-tinta/10 text-tinta/25`}
      >
        {children}
      </span>
    );
  }
  if (active) {
    return (
      <span
        aria-current="page"
        aria-label={ariaLabel}
        className={`${base} bg-rosa text-white`}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      rel={rel}
      aria-label={ariaLabel}
      className={`${base} border border-tinta/10 text-tinta hover:border-rosa hover:text-rosa`}
    >
      {children}
    </Link>
  );
}
