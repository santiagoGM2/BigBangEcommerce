# Validación de la entrega

Fecha: 7 de octubre de 2026. Base revisada: `a2973d8`; cambios en la rama
`codex/repository-hardening`. Este documento distingue verificación de código
de despliegue en producción.

## Correcciones incluidas

- Autorización privada de consulta de pedidos antes de acceder a datos personales.
- Verificación de transacciones con ePayco, moneda y entorno; actualizaciones
  condicionales que impiden degradar pedidos pagados bajo concurrencia.
- JSON-LD escapado y CSP sin `unsafe-eval` en producción.
- Dependencias actualizadas y mitigación comprobada para una alerta de desarrollo
  sin versión corregida publicada; ver [detalle](DEPENDENCY_SECURITY.md).
- Carrito sin borrado al hidratar; conservación de cantidades y sincronización
  entre pestañas sin errores de lint.
- Índice de sitemaps operativo, conservando la URL que anuncia robots.txt.
- Configuración del servidor con mezcla, validación, respaldo y reemplazo atómico.
- Esquema completo reconstruible en un proyecto nuevo, sin datos privados.
- README, guías vigentes, archivo de informes fechados, exclusión de secretos
  y verificaciones automáticas sin credenciales de producción.

Se conservan categorías, precios, políticas provisionales, stock, IDs como texto,
prioridad de productos con fotos, galería, orden de imágenes y el alcance de Drive.
No se incorporaron los cambios locales pendientes de otra pasarela de pagos.

## Evidencia local

| Comprobación | Resultado |
| --- | --- |
| Pruebas de aplicación | 56 aprobadas |
| Pruebas de fotos | 61 aprobadas |
| Regresión de dependencias | 3 aprobadas |
| Pruebas Python del proxy/actualizador | 24 aprobadas, 2 POSIX reservadas para Linux |
| TypeScript y lint general | Sin errores |
| Lint del importador | Sin errores |
| Restauración aislada del esquema | Correcta: 8 tablas con RLS, permisos, numeración, relaciones, unicidad e idempotencia |
| Build con servicios sintéticos | Correcto; 17 rutas HTTP verificadas |
| Navegador | Persistencia y cantidades del carrito, sincronización entre pestañas, flechas/zoom, galería móvil y denegación de pedidos ajenos; sin errores JavaScript |
| Lectura del catálogo real | Correcta: 15.887 filas del proxy, 15.881 productos publicables |
| Build completo con catálogo real | Correcto; 29 páginas generadas y cuatro fragmentos de sitemap |
| Secretos en el árbol final | Gitleaks sin coincidencias en el escaneo de archivos de entrega |

El build aislado genera `.next-verification`, que nunca sustituye el `.next`
utilizado para producción. Usa datos sintéticos y rechaza escrituras en los
servicios de prueba. La lectura real del catálogo y el build real consultaron
ERP/Supabase sin modificar filas ni imágenes.

La auditoría original encontró un literal de clave de procedencia no acreditada
en un test. Se sustituyó por un vector expresamente sintético. No se reescribió
el historial anterior; compartir esta entrega no implica hacer público ese historial.

## Límites y activación

No se realizaron cobros, callbacks contra pedidos reales, migraciones de
producción, cambios de Drive ni actualizaciones del servidor remoto. La batería
automatizada de pagos usa transacciones sintéticas y proveedor simulado; probar
un pago sandbox real antes de activar o cambiar credenciales comerciales.

Los originales y reportes locales, los secretos y el trabajo no publicado de
la carpeta original se mantienen fuera del paquete de código. La publicación
en producción debe usar el commit revisado, comprobar los servicios externos y
respetar el procedimiento de [entrega y recuperación](handoff-and-operations.md).

Ninguna revisión garantiza ausencia perpetua de fallos o vulnerabilidades.
La comprobación de CI rechaza nuevas alertas no mitigadas y mantiene visible
la excepción local de desarrollo documentada.
