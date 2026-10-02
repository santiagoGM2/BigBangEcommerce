# Reporte de fotos pendientes de INVENTARIO — 2 de octubre de 2026

Validación de los 372 archivos ubicados directamente en la carpeta INVENTARIO de Google Drive. Los nombres se contrastaron con el catálogo real del ERP; no se declaró inexistente ningún ID por fallos de conexión.

- 318 fotos válidas publicadas, correspondientes a 156 productos.
- 53 archivos, agrupados en 35 IDs, sin coincidencia única en el catálogo actual.
- 1 JPEG con datos corruptos.
- 203 archivos en subcarpetas ignorados deliberadamente.

## Archivos sin ID validado

Estos archivos permanecen en Drive y no se han relacionado con un producto. Un nombre sin extensión puede ser una imagen válida; el motivo de esta lista es el ID, no la extensión.

| ID leído del nombre | Archivo(s) tal como aparecen en Drive |
|---|---|
| `2900` | `2900` |
| `2901` | `2901` |
| `2902` | `2902` |
| `38010` | `38010.png` |
| `38011` | `38011.jpg`, `38011.png` |
| `38032` | `38032` |
| `38033` | `38033` |
| `38034` | `38034` |
| `38035` | `38035` |
| `38036` | `38036` |
| `38037` | `38037` |
| `38038` | `38038` |
| `38040` | `38040` |
| `38042` | `38042` |
| `38046` | `38046` |
| `38052` | `38052`, `38052-1`, `38052-2` |
| `38053` | `38053`, `38053-1`, `38053-2` |
| `38054` | `38054`, `38054(1)` |
| `38055` | `38055`, `38055(1)`, `38055(2)`, `38055(3)` |
| `38056` | `38056`, `38056(1)`, `38056(2)` |
| `38068` | `38068.jpg` |
| `38069` | `38069.jpg` |
| `38070` | `38070.jpg` |
| `38071` | `38071.jpg` |
| `38072` | `38072-1.jpg`, `38072-1.jpg`, `38072-2.jpg`, `38072-3.jpg` |
| `38073` | `38073.jpg` |
| `38074` | `38074-1.jpg`, `38074-2.jpg` |
| `38078` | `38078.jpg` |
| `38080` | `38080-1.jpg`, `38080-2.jpg`, `38080-3.jpg`, `38080-4.jpg` |
| `38081` | `38081.jpg` |
| `38082` | `38082.jpg` |
| `38083` | `38083.jpg` |
| `38084` | `38084.jpg` |
| `38107` | `38107.jpg` |
| `38512` | `38512.jpg` |

`38072-1.jpg` figura dos veces porque son dos archivos distintos en Drive con el mismo nombre. Ninguno se cargó al no validarse el ID `38072`.

## Archivo dañado

| ID validado | Archivo | Problema |
|---|---|---|
| `028502` | `28502-6.jpg` | JPEG corrupto: error de codificación Huffman; la optimización no terminó. |

## Acción requerida

- Confirmar con el responsable del ERP si los 35 IDs deben existir en la vista actual o corregir el nombre de sus fotos para que coincida con el `id_item` real.
- Reemplazar `28502-6.jpg` por un JPEG/PNG/WEBP/HEIC legible, conservando el identificador y el orden deseado.
- Colocar las correcciones directamente en `INVENTARIO`; las subcarpetas no se procesan.

## Comprobación de la automatización

- [Ejecución de publicación](https://github.com/santiagoGM2/BigBangEcommerce/actions/runs/37052743607): actualizó correctamente `13167-1.jpg`, `13167-2.jpg` y `30366(3)`; 315 imágenes no cambiaron.
- [Repetición del mismo lote](https://github.com/santiagoGM2/BigBangEcommerce/actions/runs/37053258452): 318 imágenes sin cambios, cero publicaciones y cero duplicados nuevos.
- Ambas ejecuciones quedan marcadas con incidencia por `28502-6.jpg`. Los 53 archivos sin ID se omiten y se informan; no detienen la publicación de fotos válidas.
- Conciliación final en Supabase: 318 relaciones en `producto_imagenes`, 318 objetos en Storage, cero objetos de Drive sin relación, cero URLs sin objeto y cero portadas `producto_extra.foto_url` incoherentes.

[Registro completo de la validación](https://github.com/santiagoGM2/BigBangEcommerce/actions/runs/37049382880).
