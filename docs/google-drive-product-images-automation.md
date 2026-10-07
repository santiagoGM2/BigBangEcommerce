# Automatización de fotografías desde Google Drive

## Alcance vigente

Se procesa **solo la raíz de INVENTARIO**. Las subcarpetas se ignoran. La
categoría procede del producto del ERP, no de carpetas ni nombres de imágenes.
La automatización lee Drive: no mueve, renombra, modifica ni elimina originales.
Borrar un original de Drive no elimina automáticamente una foto de la web.

La revisión está programada a las **03:17 de Bogotá** en
`.github/workflows/fotos-drive-audit.yml`. GitHub puede retrasarla; no se promete
puntualidad exacta. El proceso no necesita un computador local encendido.

## Identidad y configuración

- Carpeta: `15Nz_GHOOKbfw04s1abKMjSRzQ8RSlBjt`.
- Proyecto Google Cloud: `tiendas-big-bang-fotos`.
- Cuenta de servicio lectora: `bigbang-drive-inventory-reader@tiendas-big-bang-fotos.iam.gserviceaccount.com`.
- Autenticación de Actions mediante identidad federada, sin clave permanente.
  La confianza está limitada al repositorio, rama y workflow configurados.
- Secretos de GitHub: `CATALOGO_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL` y
  `SUPABASE_SERVICE_ROLE_KEY`. No deben aparecer en archivos ni logs.
- `DRIVE_AUTOMATION_ENABLED=true` habilita ejecuciones programadas.
- `DRIVE_PUBLICATION_ENABLED=true` permite publicaciones. La ejecución manual
  también debe solicitar publicación; en caso contrario hace dry-run.

La carpeta conserva el acceso general por enlace por decisión del propietario.
La cuenta usada por la automatización sigue siendo solo lectora. Al transferir
el repositorio, actualizar la confianza de Google y probarla: un cambio de
propietario no se resuelve únicamente copiando los secretos de GitHub.

## Flujo diario

1. Consultar los identificadores reales de la vista mediante `/producto-ids`.
   Si el catálogo falla, no escribir ni declarar identificadores inexistentes.
2. Listar archivos directos de INVENTARIO e interpretar sus nombres. Se acepta
   el ID exacto o una coincidencia única al omitir ceros iniciales.
3. Omitir versiones ya publicadas; validar y decodificar archivos nuevos o cambiados.
4. Convertir a WEBP calidad 80, sin superar 1200 px en el lado mayor. Máximo
   cinco imágenes concurrentes y dos decodificadores HEIC.
5. Registrar un intento, subir al bucket `productos` y confirmar la relación
   mediante una transacción en PostgreSQL. Actualizar la portada cuando corresponda.
6. Generar resumen y detalle de pendientes. El artefacto de Actions
   `reporte-fotos-drive-<run_id>` se conserva 30 días.

Una publicación correcta necesita la respuesta de Storage y la confirmación de
base de datos. La web mantiene catálogo y fotos en una caché de seis horas por
instancia; el refresco se inicia en segundo plano al consultar datos vencidos.
La disponibilidad de la foto puede demorarse después de la ejecución diaria.

## Orden, versiones e idempotencia

| Nombre | Posición solicitada |
| --- | --- |
| `000480.jpg` o `000480` | 1, portada |
| `000480 (1).jpg` o `000480-1.jpg` | 2 |
| `000480 (2).png` | 3 |

`producto_imagenes` mantiene `UNIQUE(id_item, orden)`.
`producto_imagen_importaciones` identifica el archivo de Drive y conserva su
producto, posición y versión publicada. El mismo archivo corregido conserva
su posición. Un archivo distinto que repite nombre recibe una posición libre:
se conservan ambos, no se interpreta como reemplazo.

Los objetos usan `drive/ID_ARCHIVO/SHA256/ID_PRODUCTO[-SUFIJO].webp`. El hash
impide sustituir los bytes anteriores antes de confirmar la nueva relación y
evita mostrar una versión antigua por caché. Repetir la misma versión conserva
objeto y relación. Las URLs públicas permanentes se guardan en
`producto_imagenes`; la RPC sincroniza `producto_extra.foto_url` para orden 1.
Las versiones anteriores no se borran automáticamente.

Para reemplazar una imagen, subir una nueva versión del mismo archivo de Drive.
Renombrarla para asignarla a otro producto requiere revisión, no reasignación
silenciosa. El [equipo tiene una guía breve](drive-instructions-for-team.md).

## Fallos y recuperación

| Situación | Resultado |
| --- | --- |
| ERP no disponible | Bloqueo previo, sin escrituras ni IDs declarados inexistentes |
| ID sin coincidencia o contenido corrupto | Incidencia del archivo; conserva originales y continúa con las demás fotos |
| Error de red, checksum o procesamiento inesperado | Error operativo y ejecución fallida |
| Storage falla | No confirma relación; deja intento detectable para conciliación |
| Storage responde OK, BD falla | Conserva URL anterior; nuevo objeto vinculado a un intento pendiente |
| Respuesta de BD perdida | Reintento idempotente sobre misma posición y contenido |
| Secundaria falla | La portada y las fotos ya confirmadas permanecen |

Un bloqueo global con vencimiento evita solapamientos del importador local y
Drive. El publicador comprueba su vigencia antes de subir y confirmar; el
workflow tiene un límite de ejecución. No borrar bloqueos o intentos para
forzar una carga sin verificar primero la operación activa.

La publicación puede completar **con advertencias de contenido** (ID pendiente,
foto corrupta). Los errores de infraestructura, Storage, BD y conciliación
siguen produciendo fallo. El dry-run es estricto: un archivo pendiente impide
declarar la tanda completamente limpia. Reemplazar la foto rechazada por una
versión válida permite reintentarlo; no existen exclusiones permanentes por nombre.

## Operación y validación

- `pnpm fotos:drive`: inventario de lectura.
- `pnpm fotos:drive:sync --dry-run`: valida y optimiza sin publicar.
- `pnpm fotos:drive:sync --publish`: publicación real, con controles previos.
- En Actions se puede inspeccionar un ID o auditar subcarpetas en modo lectura.
  Esa auditoría no cambia el alcance de la publicación.

Para confirmar que funciona hoy: revisar la ejecución más reciente, sus
advertencias, el artefacto y una ficha de producto después del refresco de caché.
Los conteos históricos están en [archive/](archive/README.md); no son una
confirmación continua del estado del servicio.
