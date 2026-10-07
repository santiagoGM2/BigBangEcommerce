# Guía para colaboradores y agentes

Leer antes de modificar el proyecto. La documentación operativa vigente está
en [README.md](README.md) y [docs/README.md](docs/README.md); `docs/archive/`
contiene evidencia histórica, no instrucciones actuales.

## Seguridad y pedidos

- `CATALOGO_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, claves privadas de ePayco y
  `ORDER_ACCESS_SECRET` nunca llegan al navegador. Sin prefijo `NEXT_PUBLIC_`.
- Las consultas administrativas usan el servidor; `pedido` y `pedido_item`
  tienen RLS sin lectura pública. No usar anon para obtener pedidos.
- El número `BB-YYYY-NNNNN` es consecutivo y público; no es una credencial.
  La confirmación verifica la cookie firmada vinculada al pedido antes de leer
  datos personales. La autorización dura siete días y depende del navegador.
- `generate_numero_pedido()` genera el número atómicamente en PostgreSQL,
  zona `America/Bogota`, con ejecución restringida. Nunca generarlo en TypeScript.
- Recalcular totales desde el catálogo en el servidor. No confiar en precios
  enviados por el navegador ni en parámetros del retorno de ePayco.
- Solo el webhook firmado confirma pago. Conservar controles de importe,
  moneda y modo de prueba, idempotencia y actualización condicional del estado;
  una notificación concurrente no debe degradar un pedido ya pagado.
- Los datos externos en JSON-LD se serializan con escape para contexto script.
  No insertar `JSON.stringify` directamente en HTML ejecutable.

## Contrato de catálogo y reglas de negocio

- El proxy devuelve exactamente `id_item`, `referencia`, `descripcion`,
  `categoria`, `codigo_barra`, `precio`, `precio_fuente`, `existencias`, `activo`.
- `id_item` siempre es string, incluidos sus ceros iniciales. Nunca convertirlo
  a número para identificar productos.
- `existencias` llega `null`; no significa agotado. `activo` aún no filtra la
  publicación. No cambiar estas reglas sin decisión comercial.
- `categoria` es el nombre crudo del ERP y se cruza con `familias.ts`. Una
  categoría desconocida se omite con warning; no inventar una familia «otros».
- `OCULTAR_RESPALDO_MAYORISTA` y `OCULTAR_CATEGORIAS_POR_CONFIRMAR` conservan
  su valor actual. CONSUMO INTERNO, PORTA CD y TRANSPORTE DOMICILIOS nunca se muestran.
- Política provisional autorizada: lista 001 pública, 002 de respaldo,
  `PRECIO_MIN_1` con impuestos incluidos. No reinterpretar precios durante un
  cambio técnico. La confirmación comercial del proveedor sigue pendiente.
- La vista ERP es solo lectura. La excepción sin TLS está autorizada únicamente
  para MariaDB mediante configuración explícita; HTTPS y SSH siguen verificados.

## Caché, rutas y rendimiento

- TTL del catálogo: seis horas, con single-flight y stale-while-revalidate.
  El estado vive en `globalThis`; el cruce de Supabase está dentro de la misma caché.
- No envolver todo el catálogo en `unstable_cache`: supera su límite de 2 MB.
  Para escalar, evaluar caché por familia. No consultar Supabase por cada request.
- `instrumentation.ts` precalienta sin tumbar la instancia ante un fallo.
- Proxy: connect 5 segundos; headers, body y watchdog global 15 segundos.
  Ante timeouts, investigar `/status` y el servidor antes de aumentar valores.
- Endpoints versionados: `/productos`, `/producto-ids`, `/status`, `/refrescar`,
  todos autenticados. No asumir que `/catalogo` existe en esta implementación.
- No generar estáticamente las ~16.000 fichas. Paginación indexable de 24 productos
  con `?page=N`; no sustituir por scroll infinito.
- Slug canónico termina en `id_item` y colapsa guiones; discrepancias y `?page=1`
  redirigen 308. Producto inexistente o no visible devuelve 404 real.
- Mantener sitemaps, sus índices y las referencias de `robots.ts` consistentes.
  Cuando Next entregue parámetros como promesas, resolverlos antes de usarlos.

## Fotografías y operaciones

- Solo fotos directamente en INVENTARIO; ignorar subcarpetas en publicación.
  Drive es solo lectura. Borrar de Drive no borra automáticamente la web.
- Portada orden 1; sufijo `(1)` o `-1` significa orden 2. Conservar imágenes
  repetidas y las asignaciones previas. No reasignar IDs de archivos ya importados.
- Storage bucket `productos`; nunca fotos de productos en Git ni en `public/`.
  `public/` contiene marca, interfaz y placeholders.
- Confirmar catálogo antes de escribir. Un fallo ERP deja IDs pendientes, no inexistentes.
- Preservar RPC transaccional, `UNIQUE(id_item, orden)`, diarios, locks y
  conciliación de Storage/BD. No marcar como procesado un archivo no confirmado.
- Un dry-run no escribe ni mueve originales. No ejecutar comandos de publicación,
  bootstrap o administración como parte de pruebas locales.
- El actualizador remoto conserva la política y campos desconocidos, guarda una
  copia privada y reemplaza atómicamente. Nunca sobrescribir toda la configuración.
- `supabase/bootstrap/` solo sirve para un proyecto nuevo vacío. No aplicarlo
  en producción ni reejecutar migraciones ya incorporadas en ese snapshot.

## Convenciones y verificación

- Código nuevo en inglés; comentarios en español; TypeScript estricto.
- Tailwind es el sistema de estilos; CSS adicional solo cuando es necesario.
- No inventar cifras comerciales, descuentos, testimonios, horarios ni stock.
  Mantener `TODO(cliente)` donde falta confirmación.
- No incluir claves, `.env*`, originales, logs privados ni reportes generados en Git.
- Ejecutar pruebas de aplicación/fotos/esquema, TypeScript y lint adecuados al
  cambio. La verificación de build aislada no equivale a una prueba de producción.
- No sobrescribir trabajo local ajeno, reescribir historial o desplegar sin alcance
  autorizado. Documentar límites reales de verificación, sin prometer ausencia total de fallos.
