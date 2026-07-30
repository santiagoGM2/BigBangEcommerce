/**
 * Hook de Next.js que corre al iniciar cada instancia del servidor
 * (en dev, en cold start serverless y en cada deploy).
 *
 * Aca precalentamos el cache del catalogo para que la primera visita de una
 * instancia fria no se coma los ~20s del fetch al proxy del ERP.
 *
 * REGLAS:
 * - El warmup JAMAS debe tumbar la instancia. Si el proxy esta caido, se
 *   loguea y la instancia sigue viva; el SWR reintentara en la primera
 *   peticion real que llegue.
 * - En produccion: await para que la instancia arranque calentita.
 * - En dev: fire-and-forget para no bloquear `next dev` cada vez que hot
 *   reload rearranca el server.
 */

export async function register() {
  // Solo el runtime de Node ejecuta esto. Si Next levantara la instancia con
  // Edge runtime, no habria server con memoria compartida donde cachear.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { precalentarCatalogo } = await import("./lib/catalogo");

  const inicio = Date.now();
  const label = process.env.NODE_ENV === "production" ? "prod" : "dev";

  const promesa = precalentarCatalogo()
    .then(() => {
      console.log(
        `[warmup:${label}] cache del catalogo listo en ${Date.now() - inicio}ms`,
      );
    })
    .catch((err) => {
      // No relanzar: la instancia sigue viva y el SWR reintentara.
      console.error(
        `[warmup:${label}] no se pudo precalentar el catalogo (la instancia sigue viva):`,
        err instanceof Error ? err.message : err,
      );
    });

  if (process.env.NODE_ENV === "production") {
    await promesa;
  }
  // En dev: no awaiteamos. next dev arranca de una y el cache se llena en
  // background.
}
