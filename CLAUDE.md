# CLAUDE.md

Contexto para futuras sesiones de Claude Code trabajando en este repo. Este
archivo lista **invariantes que no se deben violar**, decisiones ya tomadas con
su razon detras, y trampas conocidas del framework. Leelo antes de tocar nada.

## Que es este proyecto

Ecommerce de **Tiendas Big Bang** (piñateria, jugueteria, disfraces y
decoracion para fiestas en Cali, Colombia). Next.js con App Router y React
Server Components, TypeScript estricto, Tailwind CSS v4, Supabase, ePayco como
pasarela.

Catalogo en vivo desde el ERP del cliente (unos 15.900 productos), fotos aparte
que va entregando el cliente por tandas, checkout con pasarela colombiana con
confirmacion validada del lado del servidor.

## Invariantes criticas

### Seguridad

- **La API key del proxy (`CATALOGO_API_KEY`) jamas debe llegar al navegador.**
  Va sin prefijo `NEXT_PUBLIC_`. Todas las llamadas al proxy se hacen desde
  server components, route handlers o server actions.
- **La `SUPABASE_SERVICE_ROLE_KEY` jamas debe llegar al navegador.** Solo se usa
  para leer/escribir pedidos y llamar `generate_numero_pedido()`.
- **Las tablas `pedido` y `pedido_item` tienen RLS activo y ninguna policy
  publica.** Contienen datos personales. Nunca las leas con la anon key.
- **Un pedido solo pasa a estado `pagado` cuando el webhook de ePayco llega con
  firma valida.** Los parametros de la pagina de retorno son informativos y
  falsificables: nunca los uses como fuente de verdad.
- El webhook debe ser **idempotente**: recibir la misma notificacion dos veces
  no debe duplicar nada.
- **Los totales del checkout se recalculan en el servidor** desde el catalogo
  real. Nunca se confia en precios que llegan del navegador.

### Datos del catalogo

- El proxy devuelve **exactamente 8 campos por producto**:
  `id_item`, `referencia`, `descripcion`, `categoria`, `codigo_barra`, `precio`,
  `precio_fuente`, `existencias`. No hay mas.
- **`id_item` es SIEMPRE string.** Viene con ceros a la izquierda ("000002").
  Nunca lo trates como numero, se pierden los ceros.
- **`existencias` llega siempre `null` por ahora.** El proveedor del ERP aun no
  expone stock. El campo esta en el tipo, pero no construyas logica de
  "agotado" ni deshabilites el boton de compra hasta que llegue con datos.
- **`categoria` es la clave de cruce con `lib/catalogo/familias.ts`.** Nombre
  crudo del ERP en MAYUSCULAS. No lo edites.
- **`precio_fuente === 'respaldo_mayorista'`**: ~698 productos que solo tienen
  lista mayorista, no publica. Controlados por el flag
  `OCULTAR_RESPALDO_MAYORISTA`.
- **Categorias sin mapear**: si `getProductos()` encuentra una `categoria` que
  no esta en `familias.ts`, se registra warning y esos productos se omiten del
  catalogo publico. Nunca los agrupes bajo "otros" ni bajo una familia
  inventada. El warning es la senal de que hay que agregar la categoria nueva
  al mapa.

### Numero de pedido

- **Se genera con la funcion SQL `generate_numero_pedido()`** llamada desde el
  servidor con service role. Es atomica (`ON CONFLICT DO UPDATE`), usa la zona
  horaria `America/Bogota`, y el execute esta revocado de public/anon/
  authenticated. **Nunca generes el numero en TypeScript.**
- Formato: `BB-YYYY-NNNNN` (ej. `BB-2026-00001`).

## Cache del catalogo — por que asi

- **TTL 6 horas.**
- **NO usar `unstable_cache` para el catalogo completo.** El payload pesa ~4.85MB
  y el limite de `unstable_cache` es 2MB. Falla. Se usa un memo cache en
  memoria del proceso, con **single-flight lock** (para que un pico de trafico
  con cache vacio no dispare N fetches al droplet) y **stale-while-revalidate**
  (nadie espera un refresco).
- **Precalentado en `instrumentation.ts`** para que la primera visita de una
  instancia fria no se coma los ~20s del fetch. En produccion se hace con
  await; en dev se dispara sin await para no bloquear `next dev`.
- **El warmup nunca debe tumbar la instancia si falla.** Va con try/catch: si
  el proxy esta caido, se loguea y se sigue; el SWR va a reintentar en la
  primera peticion real.
- **Timeout del fetch al proxy: 30s** con `AbortSignal.timeout`. El default de
  10s no alcanza para el payload completo en frio.
- **El cruce con Supabase va DENTRO del mismo cache**, no aparte. Cachear el
  ERP por un lado y consultar Supabase en cada visita generaria una query por
  request y desincronizaria fuentes.
- **A futuro**: si el droplet sufre bajo trafico real, no forzar el payload
  completo dentro de `unstable_cache`. Cambiar a **cache por familia**: cada
  familia pesa mucho menos que 2MB y se recupera el cache compartido entre
  instancias.

## Trampas conocidas de Next 16

- **`generateSitemaps`: `id` llega como `Promise<number>`.** La documentacion
  oficial todavia lo tipa como `number`. Si no lo awaiteas, el calculo del
  rango da `NaN`, el `slice(NaN, NaN)` devuelve un arreglo vacio, y el sitemap
  responde 200 sin ninguna URL y sin ningun error visible. **Awaitealo.**
- **No usar `generateStaticParams` para las ~16.000 paginas de producto.** El
  build se volveria eterno. Se generan bajo demanda la primera vez que alguien
  las visita y quedan en cache desde ahi.
- **Sitemap dividido en dos archivos**: `app/sitemap.ts` (landing + 14
  familias, plano) y `app/producto/sitemap.ts` (con `generateSitemaps`
  shardeado de a 5000). Poner todo en un solo archivo con `generateSitemaps`
  obliga a shardear la landing y las familias tambien, lo cual es innecesario.
  `robots.ts` lista ambos.

## URLs y canonicalizacion

- Slug de producto: `descripcion-normalizada-id_item` (id al final es lo unico
  que garantiza unicidad).
- **La funcion de slugify colapsa guiones repetidos.** Sin eso queda
  `globo-semp-r9--lisa-surtida--12`.
- Si el slug recibido no coincide con el canonico, **redirige 308** al
  canonico. Idem con `?page=1`, redirige 308 a la URL sin el parametro.
- `id_item` no existe o `visible=false`: **404 de verdad**, no una pagina
  vacia con 200.
- Paginacion clasica con `?page=N`, 24 por pagina. No scroll infinito, no
  "cargar mas": la clasica es la unica que deja cada pagina indexable por
  separado.

## Datos que NO deben inventarse

Estos aparecen en el material de diseno pero **no estan confirmados por el
cliente**. Marcados con comentarios `// TODO(cliente):` en el codigo:

- "+500 productos" (real: ~16.000, usar el conteo dinamico).
- "+500 mayoristas activos en el Valle".
- Descuentos mayoristas concretos (15% / 25% / 40%).
- Testimonio "Adriana P." (no viene de Google).
- "+10 años en el mercado".
- "4.5 estrellas", "+510 reseñas".
- Horarios (dos fragmentos dicen cosas distintas).
- PayU (la pasarela real es ePayco). Mientras no haya llaves, usar
  "Pago seguro en linea".
- Costo de envio (constante en un solo lugar, marcada como pendiente).

## Flags de negocio (en `lib/catalogo/index.ts`)

Ambos arrancan en `false`. Cambiar aca cuando el cliente decida:

- `OCULTAR_RESPALDO_MAYORISTA`: oculta los ~698 productos con precio de
  respaldo mayorista.
- `OCULTAR_CATEGORIAS_POR_CONFIRMAR`: oculta las 7 categorias marcadas
  `CONFIRMAR` en el CSV (LICORES, CERVEZAS, VINO, PAPEL FOAMY, PAPEL METAL,
  PAPEL ALUMINIO, LIQUIDOS).

Las 3 categorias `OCULTAR` (CONSUMO INTERNO, PORTA CD, TRANSPORTE DOMICILIOS)
son no negociables: nunca se muestran, sin flag.

## Convenciones de codigo

- **Codigo en ingles** (variables, funciones, tipos, nombres de archivo).
- **Comentarios en español.**
- Tailwind CSS es el sistema unico de estilos. Escotilla en `globals.css`
  para keyframes, `radial-gradient`, pseudo-elementos y `backdrop-filter`
  cuando Tailwind no cubre bien.
- Nunito con pesos 400, 600, 700, 800 y 900 via `next/font/google`. No
  cargar italica (ningun fragmento la usa en produccion; testimonios.html la
  neutraliza con `font-style: normal`).
- `id_item` como string en todas partes.

## Estructura de carpetas

Ver `_data/` (documentacion del CSV origen), `_design-reference/` (los 8 HTML
originales, no se sirven en produccion), `lib/catalogo/` (capa unica de
catalogo con cache), `lib/supabase/` (clientes y tipos generados), y `app/` con
grupos `(site)` y `(checkout)`.

## Comandos utiles

```
pnpm dev              # dev server (Nunito precargada, warmup no bloqueante)
pnpm build            # produccion
pnpm gen:familias     # regenera lib/catalogo/familias.ts desde el CSV
pnpm gen:types        # regenera lib/supabase/database.types.ts desde Supabase
pnpm smoke:catalogo   # corre getProductos() e imprime breakdown
```
