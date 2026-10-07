# Importador local de fotografías

Este comando permite procesar una tanda local. La operación diaria de la
carpeta en la nube se documenta por separado en la [guía de Drive](google-drive-product-images-automation.md).

## Comandos

- `pnpm fotos --dry-run`: valida nombres, catálogo, formato, optimización y
  conciliación. No sube archivos, escribe en BD, crea bloqueos/diarios ni mueve originales.
- `pnpm fotos`: carga real. Solo archiva cada original después de confirmar
  Storage y su relación en base de datos.

Carga `.env.local` y después `.env`; requiere `CATALOGO_API_BASE`,
`CATALOGO_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
Las claves administrativas se usan solo en este proceso de servidor.
Las migraciones no se aplican automáticamente.

La carpeta `_fotos-productos-pendientes/` está ignorada completamente por Git.
Se omiten ocultos, `Thumbs.db`, enlaces y carpetas procesadas. Los diarios locales
se conservan dentro de esa carpeta junto con los originales.

## Contenido, formato y orden

Acepta JPEG, PNG, WEBP y HEIC con o sin extensión. La cabecera detecta el formato
real y la decodificación completa confirma que sea válido. Extensiones
arbitrarias, imágenes animadas o contenedores con varias imágenes se rechazan.
Sharp convierte a WEBP calidad 80, máximo 1200 px en el lado mayor, sin ampliar
archivos pequeños y conservando proporción y orientación.

HEIC se decodifica con libheif-js en un worker aislado sin variables de entorno.
Se limita a 32 MiB, 40 MP, 30 segundos y dos decodificadores simultáneos; el
máximo global es cinco archivos. El límite JS no equivale a limitar toda la
memoria WASM. No se desactivan límites internos del codec.

| Original | ID | Orden | Nombre final |
| --- | --- | --- | --- |
| `000480.jpg` o `000480` | `000480` | 1 | `000480.webp` |
| `000480 (1).heic` o `000480-1` | `000480` | 2 | `000480-1.webp` |
| `000480 (2).png` | `000480` | 3 | `000480-2.webp` |

Los IDs son cadenas. Si faltan ceros iniciales, solo se acepta una coincidencia
única con el catálogo real. El ID exacto tiene prioridad y una ambigüedad bloquea
ese archivo. Las colisiones se conservan: se reservan posiciones explícitas y
previas, se prioriza el original sin extensión y se asigna el siguiente hueco
libre desde orden 2 al adicional. El desempate por ruta es estable.

Las asignaciones se guardan atómicamente antes de una carga real en
`.fotos-import-state/assignments.json`. Un reintento parcial conserva posiciones
incluso si otros originales ya se movieron a `procesadas/`. Si se pierde el
registro, no tratar una foto desconocida como reemplazo de una relación existente.

## Validación del producto y relación

El endpoint autenticado `/producto-ids` consulta la misma vista del ERP antes
del lote. Es independiente de precios y filtros públicos. Si responde vacío,
incompleto o falla, se bloquean las subidas; no se declaran IDs inexistentes.

`producto_imagenes` tiene `id_item text`, URL pública, orden positivo y
`UNIQUE(id_item, orden)`. La FK apunta al complemento real `producto_extra`,
no a una tabla inventada del ERP. La RPC `register_product_image` conserva
UUID/fecha de creación, actualiza el registro y sincroniza `producto_extra.foto_url`
cuando `orden=1`, dentro de una transacción. La FK usa NO ACTION: no inventa
borrados en MariaDB ni elimina objetos Storage.

RLS permite leer solo imágenes de productos visibles; la escritura y la RPC
administrativa requieren service role. La galería web consume las imágenes
dentro de la misma caché de catálogo de seis horas.

## Idempotencia y fallos

El importador local usa una clave Storage estable por `(id_item, orden)` y
`upsert`; repetir o corregir no crea otra fila. Guarda URLs públicas permanentes,
no enlaces firmados con vencimiento. Una corrección puede tardar en verse por
la caché de Storage y del catálogo.

Storage y PostgreSQL no comparten transacción. Antes de subir se persiste con
fsync un diario por objeto con hash y estados `uploadAttempt`,
`storageConfirmed`, `databaseConfirmed`, `archived`. No se promete rollback
entre ambos servicios ni se borran objetos automáticamente ante fallos.

| Escenario | Comportamiento |
| --- | --- |
| Optimiza y Storage falla | Sin relación ni archivo archivado; intento detectable |
| Storage OK y BD falla | Original pendiente y diario para conciliación; el objeto puede existir |
| Storage y BD OK, movimiento falla | Estado `moveError`; reintento sobre mismas claves |
| Portada OK y secundaria falla | Portada confirmada permanece; secundaria pendiente |
| Confirmación final perdida | Conciliación compara diario, Storage y BD antes de continuar |

Un dry-run posterior revisa los intentos pendientes sin modificarlos. Para
reintentar requiere el mismo original y hash; un archivo cambiado/ausente o un
diario truncado exige revisión. Conservar originales y diarios como conjunto.

Un bloqueo local evita procesos simultáneos sobre la carpeta y un bloqueo
remoto coordina el importador con Drive. No eliminar un bloqueo sin verificar
que la operación previa terminó. Solo se mueve a `procesadas/` después de la
confirmación; si el nombre de destino existe se conserva y se utiliza un UUID
para el nuevo original.

## Evidencia

`pnpm test:fotos` valida repeticiones, correcciones, fallos parciales, límites,
conciliación, colisiones y alcance de Drive mediante datos sintéticos y HTTP
simulado. Las pruebas de esquema se ejecutan en una base aislada. Los reportes
fechados están en [archive/](archive/README.md), no representan un inventario actual.
