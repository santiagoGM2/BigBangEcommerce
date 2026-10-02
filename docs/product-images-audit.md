# Auditoria de fotos

## Estado mas reciente — servidor y cruce habilitados, 2026-10-01

Instalado `/producto-ids` con autenticacion y consulta fresca de la vista real,
HTTPS verificado y renovacion automatica. DNS apunta a 137.184.240.13.
Peticion real: 15.888 IDs completos. Importadores local y Drive usan este
endpoint sin depender de listas de precios ni impuestos. El cruce sin ceros
iniciales ya se implemento con coincidencia unica, prioridad exacta y bloqueo
de reasignaciones ambiguas. No se usa la captura local para autorizar cargas.

41/41 pruebas de fotos, 45/45 de aplicacion, TypeScript y lint del importador
pasan. Servicio HTTP: 4/4; transformador de catalogo: 7/7.
Supabase sigue con cero imagenes/fuentes/intentos. Workflow y galeria aun no
se han publicado en GitHub/Vercel: no se hizo commit. Las secciones inferiores
son el historial de auditoria y pueden describir bloqueos ya resueltos.

## Conexion y cruce real de IDs — actualizacion posterior del 2026-10-01

El propietario autorizo MariaDB sin cifrado. SELECT desde DigitalOcean funciona;
25.961 filas y 15.888 productos. Los 216 nombres locales omiten ceros iniciales.
186 fotos se cruzan de forma unica con 106 IDs reales; 30 fotos (20 IDs) no
aparecen en la vista, sin cruces ambiguos. El importador sigue sin usar esta
captura como sustituto del proxy ni habilitar subidas.
Reporte: erp-photo-identifiers-20261001.md. Falta reconstruir el proxy y confirmar
el tratamiento de impuestos y la lista publica. No se escribio en MariaDB.

## Actualizacion — 2026-10-01

La autorizacion posterior para subir y automatizar permitio aplicar las dos
migraciones: galeria y registro de fuentes/intentos/bloqueo. Las pruebas SQL
reales pasaron y se revirtieron; las cuatro tablas quedaron sin datos de prueba.
Los archivos SQL se renombraron con las versiones efectivamente registradas
en Supabase (20261001214710 y 20261001220144), evitando reejecutarlos por una
diferencia de timestamp en futuros despliegues.
No se subieron fotos ni se movieron originales. No se hizo commit.

Dry-run completo: [reporte por archivo](product-images-dry-run-20261001.txt).
216 validas/optimizadas: 133 HEIC, 73 PNG, 10 JPEG. Cero invalidas, cero errores
de imagen, 18 colisiones conservadas. 126 IDs pendientes de catalogo; ninguno
se declara inexistente. Solo una prevalidacion pendiente: proxy inaccesible.

38/38 pruebas de fotos y 45/45 de la aplicacion pasan. TypeScript pasa.
Build compila y verifica TypeScript; falla al obtener catalogo para el sitemap,
por ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR del proxy antiguo.

ESLint: se reprodujo el fallo con la configuracion original identica a HEAD.
Se corrigio FlatCompat usando las configuraciones planas y la compatibilidad
oficial de ESLint para plugins React. El analisis completo ahora muestra:
dos errores de set-state-in-effect en archivos de carrito identicos a HEAD,
y dos no-require-imports en bold.test.ts, archivo ajeno que ya estaba presente
en el working tree al comenzar esta tarea. No se modificaron esos archivos.
Se elimino una advertencia del nuevo eslint.fotos.config.mjs.

Drive: el publicador conserva posiciones por ID de archivo, usa objetos por
checksum y registra intentos antes de Storage. La URL anterior se conserva
hasta confirmar BD. Pruebas cubren repeticion, correccion, BD fallida, Storage
fallido, respuesta perdida, secundaria fallida y bloqueo expirado.
Las versiones antiguas no se borran automaticamente. El diario informa intentos
pendientes; no pretende demostrar que un objeto existe sin consultar Storage.

Bloqueos actuales: MariaDB remoto no anuncia TLS, proxy por reconstruir,
identidad federada de Drive por verificar desde GitHub y workflow sin publicar.
La IP autorizada es 137.184.240.13. SSH al nuevo Droplet esta operativo.

## Registro historico — 2026-09-15 (antes de la autorizacion posterior)

## Resultado real

Ultima ejecucion: pnpm fotos --dry-run. Codigo de salida 1 por DOS
prevalidaciones pendientes: proxy ERP inaccesible por TLS y tabla nueva aun no
aplicada. No hubo errores locales de imagen, nombre ni asignacion.

| Metrica | Resultado |
| --- | ---: |
| Archivos originales | 216 |
| HEIC sin extension, decodificados completos | 133 |
| PNG | 73 |
| JPEG | 10 |
| Imagenes validas y optimizadas | 216 |
| Invalidos/desconocidos/no admitidos | 0 |
| IDs distintos interpretados | 126 |
| IDs validados contra ERP | 0 |
| IDs demostrados inexistentes | 0 |
| IDs pendientes de consulta | 126 |
| Nombres invalidos | 0 |
| Destinos duplicados finales | 0 |
| Imagenes adicionales con orden reasignado | 18 |
| Subidas/movimientos/escrituras Supabase | 0 |

La ausencia de IDs validados no significa inexistencia. Se requiere una respuesta
correcta del proxy. SHA-256 antes/despues confirma que los originales no cambiaron.
No se crearon directorios procesadas, diarios ni asignaciones durante el dry-run.

## Asignaciones adicionales, sin descartar imagenes

Se respetan los sufijos explicitos (parentesis o guion) y se usa el siguiente
orden libre para las coincidencias. El nombre del original NO cambia.

| Archivo | Orden propuesto | Objeto |
| --- | ---: | --- |
| 14325.png | 3 | 14325-2.webp |
| 16405.png | 5 | 16405-4.webp |
| 17537.png | 5 | 17537-4.webp |
| 21860.png | 5 | 21860-4.webp |
| 21928.png | 5 | 21928-4.webp |
| 25507 (1).png | 4 | 25507-3.webp |
| 25507.png | 5 | 25507-4.webp |
| 25573.png | 5 | 25573-4.webp |
| 27130.png | 2 | 27130-1.webp |
| 28584.png | 4 | 28584-3.webp |
| 29504.png | 2 | 29504-1.webp |
| 29506.png | 6 | 29506-5.webp |
| 30208.png | 2 | 30208-1.webp |
| 30366.png | 5 | 30366-4.webp |
| 31840.png | 6 | 31840-5.webp |
| 32108.png | 5 | 32108-4.webp |
| 32303.png | 5 | 32303-4.webp |
| 33556.png | 5 | 33556-4.webp |

Ejemplos de HEIC validos: 10144 -> 10144.webp (900x1200),
11777 -> 11777.webp (301x1200), 14325 -> 14325.webp (900x1200).
28613-1/-2/-3, 38052-1/-2 y 38053-1/-2 se interpretan como secundarios,
sin necesidad de renombrarlos. Al aplicar la tabla se volveran a comprobar las
posiciones remotas antes de persistir y usar estas asignaciones.

## Idempotencia y fallos: evidencia

28 pruebas del importador pasaron, incluyendo el SDK real con transporte HTTP
simulado que comprueba x-upsert=true. Dos tandas identicas mantuvieron dos
objetos y dos filas; una correccion cambio bytes manteniendo las claves y la
principal. Otra prueba comprueba que un duplicado reasignado conserva su orden
al reintentar solo el archivo pendiente. El registro de asignaciones se prueba
en disco temporal, incluyendo lectura, persistencia y rechazo de otro proyecto.

A: Storage falla -> cero filas, cero archivos marcados success y diario previo.
B: Storage OK/BD falla -> objetos presentes, cero filas, originales pendientes;
el diario detecta el objeto sin relacion y permite reintento sobre la misma clave.
C: BD OK/mover falla -> moveError, relaciones confirmadas, diario databaseConfirmed;
el reintento conserva numero de objetos/filas.
D: principal OK/secundaria falla -> principal intacta, solo secundaria pendiente.
Tambien se simulo una respuesta perdida DESPUES de escribir Storage: el intento
previo persistido permite detectar el objeto aun sin confirmacion de la subida.

No se escribio en Supabase para estas pruebas. La migracion se ejecuto solo en
PGlite temporal: repeticiones conservaron UUID/created_at; UNIQUE, FK y orden>=1
rechazaron datos invalidos; borrar el padre con fotos fallo por FK; RLS y permisos
funcionaron para anon/authenticated/service_role. Un fallo inyectado dentro de la
RPC revirtio tanto la imagen como la principal.

La FK es text -> producto_extra.id_item text, no hacia una tabla ERP inventada.
El indice UNIQUE (id_item, orden) cubre busquedas y FK. Timestamps actualizados
por RPC; NO ACTION para borrado del complemento; sin cascada a MariaDB/Storage.

## Herramientas y ESLint

- pnpm test:fotos: 28/28.
- pnpm test: 45/45 pruebas existentes.
- pnpm typecheck: codigo 0.
- pnpm lint:fotos: codigo 0, sin errores ni advertencias.
- git diff --check: sin errores de espacios.

Fallo global PREEXISTENTE: FlatCompat/React lanza TypeError al construir la
configuracion, incluso al analizar lib/catalogo/proxy.ts sin cambios.
eslint.config.mjs tiene el mismo SHA-256 normalizando LF en HEAD y working tree:
e6c763f8e70a4e937676adac4df0234d6d407494c8b69c6ef3e1fde620647d11.
HEAD ya fijaba ESLint 10.8.0 y eslint-config-next 16.2.12.
El lint del importador usa reglas TypeScript de Next, sin plugins React de UI;
no se modifico la configuracion global ni se atribuye su fallo a los nuevos archivos.

## Bloqueos restantes

1. DigitalOcean: el propietario informa suspension por impago. DNS resuelve
api.tiendasbigbang.com a 159.89.86.21. Node TLS y curl fallan tambien fuera del
importador. Node TLS hacia Supabase funciona con certificado verificado y TLS 1.3.
Esto descarta un fallo exclusivo del importador y coincide con el servidor
apagado, sin probar por si solo la causa administrativa de cada alerta TLS.
Hay que reconstruir el Droplet destruido y comprobar el servicio proxy.
2. La migracion sigue SIN APLICAR por instruccion del propietario. No puede
validarse una escritura real contra una tabla que aun no existe.

No se hizo commit, no se ejecuto pnpm fotos sin --dry-run, no se aplico ninguna
migracion y no se movieron ni renombraron originales.
