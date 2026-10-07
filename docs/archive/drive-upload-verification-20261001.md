# Resultado de fotos de Drive — 1 de octubre de 2026

## Estado final comprobado

| Concepto | Resultado |
| --- | ---: |
| Archivos en Drive | 372 |
| Imagenes decodificadas/optimizadas en dry-run | 371 |
| Fotos publicadas y relacionadas | 318 |
| Productos con fotografias | 156 |
| Archivos con ID sin coincidencia en la vista | 53 |
| IDs distintos sin coincidencia | 35 |
| JPEG corrupto | 1 |
| Objetos en Storage | 318 |
| URLs publicas WEBP verificadas | 318 |
| Relaciones duplicadas | 0 |
| Intentos pendientes tras recuperacion | 0 |
| Principales inconsistentes | 0 |
| Bloqueos persistentes | 0 |

La relacion usa producto_imagenes (ID canonico como cadena, URL HTTPS y orden).
La foto de orden 1 coincide con producto_extra.foto_url. Categoria se obtiene
del ERP mediante el producto relacionado; no se inventan categorias de fotos.
Los originales de Drive no se movieron, renombraron ni eliminaron.

## Evidencia de repeticion y recuperacion

1. [Dry-run real](https://github.com/santiagoGM2/BigBangEcommerce/actions/runs/36951950850):
   372 archivos, 318 listos, 53 IDs pendientes, un JPEG corrupto, cero subidas.
2. [Primera carga](https://github.com/santiagoGM2/BigBangEcommerce/actions/runs/36952418441):
   317 subidas; 12788 tuvo un fallo de Storage y su intento quedo registrado.
3. [Reintento](https://github.com/santiagoGM2/BigBangEcommerce/actions/runs/36952819533):
   317 archivos omitidos por version ya publicada; una subida pendiente recuperada.
4. [Misma tanda completa](https://github.com/santiagoGM2/BigBangEcommerce/actions/runs/36953158446):
   cero optimizados/publicados, 318 omitidos sin cambios. SQL conserva 318
   objetos y relaciones, sin duplicados, sin intentos pendientes.

Los jobs muestran fallo por el JPEG corrupto: ese archivo nunca se considero
publicado. Las otras fotos terminaron correctamente; la automatizacion continua
con las siguientes tandas. UNIQUE(id_item, orden) y fuente Drive persistida
conservan todas las imagenes repetidas en posiciones distintas.

## Automatizacion y pendientes

Workflow publicado en main, identidad federada de Google sin clave permanente,
cuenta de Drive solo lectora. Secretos privados de GitHub configurados y ambos
interruptores activos. Horario diario programado: 03:17 de America/Bogota.
El trabajo usa como maximo cinco archivos simultaneos, dos decodificadores HEIC,
WEBP calidad 80 y lado mayor hasta 1200 px.

- Reemplazar la version de 28502-6.jpg: datos JPEG corruptos, bad Huffman code.
- Revisar 53 archivos/35 IDs con el proveedor: [detalle](drive-images-manual-review-20261001.md).
- La web aun no tiene desplegada la galeria. Vercel compila y pasa TypeScript,
  pero /productos HTTP 503 impide generar el sitemap. Hace falta confirmar
  lista publica e impuestos para habilitar ese contrato y completar el deploy.
  [Log de Vercel](vercel-photo-deploy-20261001.txt).

## Verificaciones de codigo

41 pruebas del importador/Drive pasan, TypeScript y lint de archivos nuevos pasan.
En la copia aislada publicada pasan tambien las 15 pruebas de aplicacion existentes.
La copia original con cambios de pagos pendientes tiene 45 pruebas correctas,
pero esos cambios no se publicaron. El lint global de esa copia mantiene cuatro
errores preexistentes/ajenos (carrito y pruebas Bold); el importador aporta cero.
Cuatro pruebas del endpoint de IDs y siete del transformador ERP pasan.

La publicacion se hizo desde una copia aislada basada en origin/main: no publico
el commit local previo de skeletons/CSP ni los cambios de pagos. La copia original
se conserva con su trabajo pendiente; los commits de fotos estan en GitHub main.
