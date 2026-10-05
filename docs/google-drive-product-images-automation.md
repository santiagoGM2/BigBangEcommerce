# Automatizacion de fotografias desde Google Drive

## Actualizacion — 2026-10-05

Las ejecuciones programadas de los dias 3, 4 y 5 llegaron al catalogo y a Drive.
El JPEG `28502-6.jpg` mantuvo el error `bad Huffman code` y hacia fallar el lote
completo aunque las 318 fotos validas ya estuvieran publicadas. El dia 3 se
publico correctamente una version nueva y se omitieron 317 sin cambios.

La publicacion ahora distingue contenido rechazado de fallos operativos:

- `invalidImage`: rechazo inequivoco del decodificador; no se sube ni se marca
  como publicada. Junto a los IDs sin coincidencia, se muestra como incidencia
  pendiente del archivo y no hace fallar por si sola la publicacion diaria.
- Red, checksum, disco, errores inesperados de procesamiento, Storage, BD,
  bloqueo y operaciones sin conciliar siguen produciendo salida 1.
- El dry-run sigue siendo estricto: un archivo pendiente impide declarar un
  lote completamente limpio.
- Cada publicacion guarda el resumen y el detalle en Markdown y JSON como
  artefacto `reporte-fotos-drive-<run_id>` durante 30 dias, ademas de mostrar una
  advertencia visible en GitHub. No se silencia ningun error con `continue-on-error`.
- Al reemplazar una foto rechazada por una copia sana se vuelve a evaluar en
  la siguiente ejecucion; no hay exclusiones permanentes por nombre.

El horario sigue programado a las 03:17 de Bogota, sujeto a retrasos del
scheduler de GitHub. El 5 de octubre comenzo a las 12:12 de Bogota.
Las secciones siguientes conservan el historial y sus resultados originales.

## Actualizacion — 2026-10-02

El fallo de despliegue descrito en el historial inferior fue corregido con
6419e03. La web publica muestra las 318 fotos en 156 productos y las 14 familias
responden correctamente. La ejecucion programada de hoy (37022265761) leyo
372 archivos: 318 sin cambios, 53 sin ID en la vista y un JPEG corrupto.
El scheduler ejecuto esa revision a las 09:46 de Bogota, despues del horario
programado; no se promete puntualidad exacta. Instrucciones operativas actuales:
[Guia para el equipo](drive-instructions-for-team.md).

## Estado comprobado — 2026-10-01

### Carga real y automatizacion activada

Con autorizacion expresa posterior se publicaron los cambios de fotos en main,
excluyendo los cambios de pagos y el commit local previo de skeletons/CSP.
Los secretos privados de GitHub estan configurados y ambos interruptores
DRIVE_AUTOMATION_ENABLED y DRIVE_PUBLICATION_ENABLED estan en true.
Revision diaria: 03:17 de Bogota, sujeta a la ejecucion del scheduler de GitHub.

Drive real: 372 archivos, 318 imagenes publicadas para 156 productos,
53 archivos correspondientes a 35 IDs sin coincidencia en la vista, y un
JPEG corrupto (28502-6.jpg). Los originales permanecen intactos.

Primera carga: 317 publicadas, una subida de Storage fallo y quedo en el diario.
Reintento: 317 omitidas sin cambios, una recuperada. Resultado SQL: 318 objetos,
318 relaciones, cero relaciones duplicadas, cero intentos pendientes, cero
bloqueos y cero discrepancias entre principal orden 1 y producto_extra.foto_url.
El job sigue indicando fallo por el JPEG corrupto; no se oculta ese error.
Una tercera ejecucion de la misma tanda omitio las 318 fotos: cero nuevas
subidas. Las 318 URLs publicas devolvieron WEBP valido, sin errores.
Resultado final detallado: drive-upload-verification-20261001.md.

- [Validacion inicial](https://github.com/santiagoGM2/BigBangEcommerce/actions/runs/36951950850).
- [Carga inicial](https://github.com/santiagoGM2/BigBangEcommerce/actions/runs/36952418441).
- [Recuperacion e idempotencia](https://github.com/santiagoGM2/BigBangEcommerce/actions/runs/36952819533).
- Detalle: drive-inventory-validation-20261001.txt y drive-images-manual-review-20261001.md.

Vercel: compilacion y TypeScript correctos; el deploy falla al generar
/producto/sitemap/[__metadata_id__] porque /productos responde 503 mientras
se confirma lista de precios e impuestos. La galeria esta publicada en codigo,
pero aun no desplegada correctamente. No se afirma que las fotos ya se vean
en la web publica. La automatizacion de fotos funciona independientemente.

Las siguientes secciones conservan el historial previo a la carga.

Implementados el lector, el publicador y la galeria de producto. Aplicadas las
migraciones de galeria y seguimiento con la autorizacion posterior para realizar
la carga. No hay fotos publicadas: las tablas de imagenes, fuentes, intentos y
bloqueos quedaron vacias despues de las pruebas SQL revertidas.

El endpoint autenticado `GET /producto-ids` ya esta instalado en el Droplet,
con HTTPS valido y renovacion automatica. DNS apunta a la IP reservada
137.184.240.13. Consulta DISTINCT ID_ITEM en la misma vista real antes de cada
lote y nunca devuelve una copia antigua ante fallo del ERP.
Se verificaron 15.888 identificadores con una peticion HTTPS autenticada.
El propietario autorizo conectar MariaDB sin TLS; la vista contiene
25.961 filas y 45 columnas. La lista publica y los impuestos siguen pendientes
antes de publicar precios en `/productos`; las fotos no dependen de esa regla.
La excepcion no altera HTTPS ni la validacion de certificados de otros servicios.

## Drive e identidad

Carpeta INVENTARIO: `15Nz_GHOOKbfw04s1abKMjSRzQ8RSlBjt`, compartida desde una
unidad personal. Se conserva el acceso general por enlace por decision expresa
del propietario.

Proyecto Google Cloud: `tiendas-big-bang-fotos` (474166276006).
Cuenta lectora: `bigbang-drive-inventory-reader@tiendas-big-bang-fotos.iam.gserviceaccount.com`.
Tiene acceso Lector a la carpeta, sin roles del proyecto ni claves permanentes.

Identidad federada limitada al repositorio `santiagoGM2/BigBangEcommerce`, rama
main y archivo `.github/workflows/fotos-drive-audit.yml`. La lectura con esa
identidad aun no se ha probado en GitHub: el workflow no se ha publicado.
Localmente el dry-run de Drive se detiene por ausencia de credenciales ADC;
no se ha contado ni descargado el inventario de la nube.

## Comandos y activacion

- `pnpm fotos:drive`: escaner de lectura.
- `pnpm fotos:drive:sync --dry-run`: valida y optimiza sin escribir.
- `pnpm fotos:drive:sync --publish`: publicacion; exige catalogo disponible antes de cualquier escritura.
- `pnpm fotos --dry-run`: importador de originales locales.

El workflow se ejecutara a las 03:17 de Bogota una vez al dia. Necesita:
`CATALOGO_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
como secretos de GitHub. Nunca imprime las claves ni guarda fotos en artefactos.

`DRIVE_AUTOMATION_ENABLED=true` permite ejecuciones programadas.
`DRIVE_PUBLICATION_ENABLED=true` permite publicar. Sin este segundo interruptor
se hace dry-run. La ejecucion manual tiene una opcion de publicacion que tambien
requiere el segundo interruptor. Ninguno se ha activado aun.

## Posiciones y recuperacion

`producto_imagenes` guarda URL y orden; UNIQUE (id_item, orden).
Los nombres sin ceros se resuelven al ID real solo si la coincidencia es unica:
14325 pasa a 014325. Se comparan cadenas y un ID exacto tiene prioridad.
Un alias ambiguo se bloquea. Las asignaciones persistidas no cambian de producto.
La RPC transaccional mantiene `producto_extra.foto_url` cuando orden=1.
La galeria del sitio consume estas filas dentro del mismo cache del catalogo.

`producto_imagen_importaciones` conserva el ID de archivo de Drive, producto,
posicion y version observada/publicada. El mismo archivo mantiene su posicion
al corregirse. Un archivo distinto con nombre repetido recibe un hueco libre
desde orden 2. Renombrar un archivo existente a otro producto exige revision.

`producto_imagen_intentos` registra el intento antes de subir. Ruta:
`drive/ID_ARCHIVO/SHA256/ID_PRODUCTO[-SUFIJO].webp`.
El nombre final sigue siendo limpio. El hash evita sustituir el objeto anterior
antes de confirmar la BD y evita cache antigua. La misma version/contenido
reutiliza ruta y relacion; versiones antiguas se conservan, sin borrado automatico.

Un bloqueo global de dos horas evita solapar importador local y publicador Drive.
El workflow tiene limite de 45 minutos. Antes de Storage y de confirmar en BD
se verifica que el bloqueo sigue vigente. Se liberan los bloqueos al terminar.

| Falla | Comportamiento |
| --- | --- |
| Catalogo inaccesible | No publica ni declara IDs inexistentes. |
| Optimizacion | Registra fallo y sigue con otras imagenes. |
| Storage | No publica la relacion; intento pendiente detectable. |
| Storage OK / BD falla | URL anterior intacta; nuevo objeto asociado a intento pendiente y reintentable. |
| Respuesta BD perdida | Reintento idempotente, misma posicion y contenido. |
| Secundaria falla | Principal y otras fotos confirmadas permanecen. |

Drive queda intacto: no mueve, renombra ni elimina originales.
El importador local mueve originales solo tras confirmar Storage y BD; si el
movimiento falla conserva el archivo y su diario para conciliacion.

## Validaciones y siguientes pasos

Inventario local: 216 validas (133 HEIC, 73 PNG, 10 JPEG), cero corruptas.
Cruce con la vista real: 186 fotos de 106 productos; 30 fotos de 20 IDs
sin coincidencia en la vista actual. El conteo de Drive aun no se ha obtenido.
Dry-run nuevo completo con consulta real: 216 optimizadas, 186 listas, 30 sin
ID en la vista, 18 fotos adicionales preservadas, cero errores de procesamiento,
Storage o BD, cero problemas de prevalidacion. No publico ni movio originales.
Para superar la cache DNS antigua se uso temporalmente la IP reservada con
validacion HTTPS intacta; se retiro la variable al terminar.
Reporte completo: `product-images-dry-run-20261001.txt`.

41 pruebas de fotos, TypeScript y lint del importador pasan. Cuatro pruebas
del endpoint de IDs y siete del transformador de precios pasan.
Pruebas SQL reales,
revertidas: bloqueo concurrente, posiciones, publicacion sin confirmar rechazada,
repeticion, correccion, URL principal y permisos privados.

Pendiente: publicar workflow y configurar secretos en GitHub, primera validacion
real de Drive, carga inicial y activacion diaria. Para mostrar el catalogo completo
en Vercel quedan las reglas de precios y el despliegue de la galeria.
No se ha hecho commit; sigue vigente la instruccion anterior de no hacerlo.

Durante la propagacion se puede usar CATALOGO_CONNECT_IP=137.184.240.13 para
el dry-run local. Solo fija la resolucion de red; conserva SNI y validacion del
certificado HTTPS. No se configura en GitHub Actions.

El Droplet de USD 4 se dedica al proxy. Conversiones se ejecutan en GitHub Actions;
los limites/costos de Actions y Supabase son independientes del Droplet.
