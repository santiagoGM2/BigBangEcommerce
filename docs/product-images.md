# Importacion masiva de fotografias

## Uso y configuracion

`pnpm fotos --dry-run` valida y optimiza en memoria sin subir, escribir BD, crear
locks/diarios, renombrar ni mover originales. Codigo 1 significa pendientes o
bloqueos; codigo 0 requiere validacion completa. `pnpm fotos` es la carga real:
NO ejecutada todavia. La migracion tampoco se aplica automaticamente.

Carga `.env.local` y luego `.env`: CATALOGO_API_BASE, CATALOGO_API_KEY,
NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. El CLI es server-only.
No usa anon para administrar. `_fotos-productos-pendientes/` esta ignorada por
Git completa. Se omiten ocultos, Thumbs.db, enlaces y carpetas procesadas.

## Contenido y nombres

Con la ampliacion autorizada, acepta JPEG, PNG, WEBP y HEIC, con o sin extension.
La cabecera identifica el formato; solo la decodificacion completa confirma su
validez. Una cabecera con datos truncados falla. No se aceptan extensiones
arbitrarias, aunque el contenido sea una imagen.

HEIC usa libheif-js 1.23.2 WASM en un worker local sin variables de entorno del
proceso. No se desactivan limites internos del codec. Se limita a 32 MB de
entrada, 40 MP, 30 segundos y dos decodificadores simultaneos. Heap JS: 128 MB
(este limite no incluye memoria WASM). Cada worker se termina tras una imagen.
Se rechazan contenedores con multiples imagenes de nivel superior.
libheif aplica la orientacion del contenedor; sharp convierte los pixeles a WEBP.

Sharp limita a 1200 px en el lado mayor, conserva proporcion, no amplia imagenes
pequenas y usa calidad WEBP 80. JPEG/PNG/WEBP reciben orientacion EXIF. Se procesan
como maximo cinco archivos a la vez, con hasta dos HEIC dentro de ese limite.

| Original | id_item | orden | Storage |
| --- | --- | --- | --- |
| 000480.jpg / 000480 | 000480 | 1 | 000480.webp |
| 000480 (1).heic / 000480(1) / 000480-1 | 000480 | 2 | 000480-1.webp |
| 000480 (2).png / 000480(2) | 000480 | 3 | 000480-2.webp |

Conserva los IDs reales como cadenas y los huecos de orden. Si el nombre omite
ceros, se acepta solo un cruce unico con el catalogo real (14325 -> 014325).
IDs exactos tienen prioridad; alias ambiguos se bloquean. Por decision del propietario,
se conservan TODOS los archivos que originalmente apuntaban al mismo destino.
Primero reserva posiciones previas y sufijos explicitos; para una colision,
prioriza el original sin extension y desempata por ruta textual estable. Las
otras imagenes reciben el siguiente orden libre desde 2, sin desplazar las
secundarias explicitas. No renombra originales ni depende del orden de lectura.

Antes de cualquier subida real, persiste atomicamente TODAS las asignaciones
en .fotos-import-state/assignments.json (proyecto, archivo, ID, orden y objeto).
Los reintentos parciales y correcciones del mismo archivo mantienen esa posicion,
aunque las otras fotos ya esten en procesadas. El dry-run solo calcula y muestra
el plan, sin crear ese registro. Si la tabla existe, consulta sus posiciones
ocupadas para no pisar imagenes sin una asignacion local conocida. Si se pierde
el registro, la recuperacion de correspondencias requiere revision; no se
interpreta un archivo desconocido como correccion de una foto remota existente.
Mientras falta la tabla, los ordenes del dry-run son una propuesta local: deben
validarse otra vez con la migracion aplicada antes de cargar.

## Catalogo y suspension

Los IDs vienen de `/producto-ids`, consulta autenticada a la misma vista real
del ERP desde el Droplet. Es independiente de precios y de los filtros de
publicacion de la tienda. producto_extra no es el ERP.
Un catalogo inaccesible, vacio o malformado bloquea todas las subidas: los IDs
quedan sin validar, nunca se declaran inexistentes por un fallo de conexion.

El historial de DigitalOcean confirma que el Droplet anterior fue destruido;
no hay backups ni snapshots en el panel. El nuevo Droplet ya sirve IDs mediante
HTTPS valido, DNS 137.184.240.13 y certificado con renovacion automatica.
La vista MariaDB es de solo lectura y no se modifica; la conexion ERP sin TLS
fue autorizada expresamente por el propietario. HTTPS sigue verificado en todos
los servicios. No se publican precios hasta confirmar las reglas comerciales.

## Migracion revisada y aplicada con autorizacion posterior

supabase/migrations/20261001214710_product_images.sql esta basada en consultas
reales de solo lectura al proyecto rzhzuvmrnfuctwyunhiu. producto_extra tiene PK
id_item text, foto_url text, visible boolean default true, nota y timestamps
timestamptz. No hay una tabla local de productos del ERP.

La nueva producto_imagenes tiene UUID, id_item text compatible, foto_url text,
orden integer CHECK (orden > 0), created_at/updated_at con now(). La FK apunta al
complemento real producto_extra(id_item). UNIQUE (id_item, orden) crea el indice
B-tree que cubre upsert, busquedas por producto/orden y comprobacion de FK: no se
agrega otro indice redundante por id_item.

La FK usa NO ACTION: impide borrar un complemento con fotos. No se inventa una
cascada al ERP ni un borrado automatico de objetos Storage.

RLS permite a anon/authenticated solo leer fotos de productos visibles. La RPC
register_product_image es SECURITY INVOKER, con EXECUTE solo para service_role.
Crea el complemento si falta, hace upsert y sincroniza producto_extra.foto_url
para orden 1 en una transaccion. Conserva visible/nota, UUID y created_at;
actualiza updated_at desde la RPC (no hay trigger universal para SQL externo).

La tienda mantiene su campo principal; las secundarias quedan en la nueva tabla.
No se agrega una galeria visual. El cache del catalogo tiene TTL de seis horas.

## Idempotencia y fallos parciales

La clave Storage depende exclusivamente de (id_item, orden); upload usa upsert.
La URL publica permanente de getPublicUrl() se guarda en producto_imagenes y,
para orden 1, tambien en producto_extra. No son URLs firmadas con vencimiento.
Una correccion reemplaza bytes en la misma URL; el cache de una hora puede
retrasar su visualizacion.

Repetir una tanda no crea claves ni filas nuevas. Si los originales ya fueron
archivados, la siguiente ejecucion no los encuentra; si se presentan de nuevo,
se actualizan las mismas claves. La combinacion UNIQUE evita duplicados en BD.

Storage y PostgreSQL no comparten transaccion: un reemplazo puede ser visible
antes de confirmar BD. No se promete rollback entre servicios ni se borran
objetos automaticamente al fallar la BD.

| Escenario | Comportamiento |
| --- | --- |
| A: Storage falla | No se llama BD ni se archiva; el intento queda pendiente incluso si la respuesta se perdio despues de escribir. |
| B: Storage OK, BD falla | Original pendiente y diario para detectar un objeto huerfano o reemplazo pendiente. |
| C: Storage/BD OK, mover falla | moveError, no success; diario databaseConfirmed; reintento sobre mismas claves. |
| D: principal OK, secundaria falla | Principal confirmada intacta; solo secundaria queda pendiente. |

Antes de Storage se persiste con fsync un diario append-only por objeto en
.fotos-import-state/ dentro de la carpeta ignorada. Registra clave, ID, orden,
original, SHA-256 del WEBP e hitos uploadAttempt/storageConfirmed/
databaseConfirmed/archived. Si no puede persistir, no comienza la siguiente
etapa. No guarda secretos.

El siguiente dry-run consulta los intentos pendientes, Storage y BD. Detecta
contenido distinto o falta de relacion; no borra ni resuelve automaticamente.
Para reintentar exige el mismo original/hash. Si falta o cambio, bloquea para
revision. Un diario truncado tambien bloquea. Conservar el diario junto a los
originales: si se pierde, no se garantiza detectar todos los intentos anteriores.

Un lock local, tomado antes de leer las asignaciones, impide cargas simultaneas
sobre la misma carpeta. Si queda tras
un cierre abrupto, verificar que no haya un proceso activo antes de retirarlo.
No coordina computadoras diferentes: operar un solo importador sobre el bucket.

Solo se archiva tras confirmar Storage y respuesta RPC. Si existe el destino
original, se conserva y se agrega UUID al nuevo archivo. Si falla el diario
final despues de mover, se informa explicitamente; BD ya estaba confirmada.

## Verificacion

pnpm test:fotos ejercita SDK real con HTTP simulado (sin red): repeticiones,
correccion, escenarios A-D, respuesta perdida, diario y recuperacion. La
migracion se verifica por separado en PGlite temporal: UUID/created_at,
UNIQUE/FK/orden, timestamps, rollback atomico de RPC, RLS y privilegios.

pnpm lint:fotos usa reglas TypeScript de Next sin plugins de UI. El fallo global
FlatCompat/React se reproduce sobre lib/catalogo/proxy.ts sin modificaciones;
el hash de eslint.config.mjs coincide con HEAD y las versiones de ESLint/Next
ya estaban en el lockfile de HEAD. No se modifico esa configuracion global.

Fuentes: [DigitalOcean](https://docs.digitalocean.com/support/ive-paid-my-bill-so-why-arent-my-services-online/),
[libheif-js](https://github.com/catdad-experiments/libheif-js).
