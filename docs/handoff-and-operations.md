# Entrega, operación y recuperación

## Alcance de la entrega

El repositorio contiene la aplicación, el proxy del ERP, la automatización de
fotos, sus pruebas y el esquema para reconstruir una base Supabase nueva.
La entrega de código y la transferencia de propiedad de servicios son pasos
separados. Las cuentas, credenciales, cobros y respaldos se administran fuera de Git.

Compartir el repositorio privado invitando cuentas nominativas. Dar permisos
según su función; no compartir contraseñas personales. Hacerlo público expondría
también su historial y documentación interna, aunque no otorgue permiso de escritura.
El historial anterior no se reescribe como parte de esta organización.

## Inventario de servicios

| Servicio | Qué debe conservar el negocio | Acceso técnico necesario |
| --- | --- | --- |
| GitHub | Repositorio y controles de Actions | Código, revisiones, workflows y secretos según rol |
| Vercel | Proyecto, despliegue y variables privadas | Despliegues, logs y configuración durante el soporte |
| Dominio/DNS | Titularidad, renovación y registros | Edición de los registros necesarios, sin compartir cuenta |
| Supabase | Proyecto, base de datos y Storage | Esquema, RLS, respaldos y operación; service role solo servidor |
| DigitalOcean | Team, Droplet, IP reservada y facturación | Administración técnica y recuperación |
| Google Drive/Cloud | Carpeta y cuenta lectora federada | Compartición de carpeta y confianza de identidad |
| ePayco | Cuenta comercial y configuración de pagos | Configuración de integración por canal privado |
| Proveedor ERP | Vista y cuenta de lectura | Autorización de la IP y confirmación del contrato |

Los accesos de marketing para métricas o píxel no requieren las credenciales
administrativas de base de datos, ERP o pagos. Acordar el alcance del soporte,
responsable de facturación y canal de incidencias al entregar. Registrar el
inventario de propietarios/contactos en un documento privado del negocio.

## Antes y después de transferir

1. Confirmar cuentas de destino, soporte contratado y permisos disponibles en
   el plan de cada proveedor; consultar su documentación y panel actuales.
2. Guardar una copia privada de la configuración y respaldos verificables.
   No poner secretos en ZIP de código, correos, tickets ni capturas.
3. Revisar conexiones GitHub–Vercel, dominios, variables y webhooks. Transferir
   el código no transfiere automáticamente Supabase, Drive, ERP ni la pasarela.
4. Si cambia el propietario o nombre del repositorio, actualizar la condición
   de la identidad federada Google, sus bindings y la configuración del workflow.
   Comprobar que no queden permisos al repositorio anterior innecesariamente.
5. Ejecutar las verificaciones locales y un despliegue de prueba. Revisar
   inicio, categorías, paginación, ficha con galería, carrito y confirmación privada.
6. Probar lectura de Drive con dry-run, revisar el reporte y comprobar el
   horario y ambos interruptores en GitHub antes de reanudar publicación.
7. Validar dominio, HTTPS, DNS del proxy y renovaciones. Retirar accesos
   temporales solo cuando el responsable y el soporte tengan acceso probado.

## Configuración y secretos

Usar `.env.example` como inventario de variables, `.env.local` en desarrollo y
los gestores privados de Vercel/GitHub/servidor en producción. Nunca copiar una
variable administrativa con el prefijo `NEXT_PUBLIC_`.

`ORDER_ACCESS_SECRET` puede ser una clave independiente de al menos 32
caracteres. Sin ella, el servidor usa la service role para firmar mediante HMAC
con un contexto exclusivo de acceso a pedidos.
La confirmación requiere cookie del mismo navegador, vigente durante siete días;
una URL con un número de pedido no autoriza lectura. Rotar la clave de acceso
(o la service role cuando se usa como origen) invalida autorizaciones anteriores.
El pago se sigue confirmando por webhook firmado, no por esa cookie.
Los pedidos creados antes de este cambio no recibieron esa cookie. Para
consultarlos desde un enlace antiguo, otro navegador o después del vencimiento,
el soporte debe verificar al comprador por un canal privado. No restaurar el
acceso público por número para resolver esos casos.

Conservar la política comercial autorizada del ERP. La conexión sin TLS está
permitida únicamente para MariaDB por decisión del propietario; no extender
esa excepción a otras conexiones. Las llaves SSH y claves de servicio no se
entregan a usuarios que solo necesitan métricas.

## Reconstrucción de Supabase

El esquema fue capturado mediante lectura de metadatos reales, sin filas de
clientes, pedidos, catálogo ni secretos.

- `supabase/bootstrap/public-schema.sql`: fotografía completa del esquema
  público para un **proyecto Supabase nuevo y vacío**. Incluye tablas, funciones,
  restricciones, índices, RLS, políticas, permisos y las dos migraciones de fotos.
  Aborta si ya existen tablas en `public`; no es una actualización de producción.
- `supabase/bootstrap/storage-bucket.sql`: configuración del bucket `productos`
  que debe ejecutarse después, en el mismo proyecto nuevo. No copia objetos.
- `supabase/migrations/`: historial de cambios incrementales. Las dos
  migraciones iniciales de fotos ya están incorporadas en el bootstrap completo;
  no aplicarlas de nuevo sobre él. Conciliar el historial de migraciones antes
  de automatizar cambios posteriores.

Procedimiento: crear el proyecto aislado, comprobar que `public` esté vacío,
ejecutar el esquema y luego la configuración del bucket, restaurar los datos
privados desde un respaldo verificado y copiar los objetos Storage mediante el
mecanismo del proveedor. Revisar permisos y URLs antes de apuntar la web al
nuevo proyecto. Una nueva URL de Supabase obliga a revisar las URLs de fotos
persistidas; el código SQL de esquema no las transforma.

El esquema **no es un respaldo de datos**. Mantener copias independientes de
pedidos, complementos, galerías, seguimiento de importaciones y objetos Storage.
No probar recuperaciones vaciando ni sobrescribiendo producción. Validar las
migraciones en un entorno de prueba antes de aplicarlas a un servicio existente.

## Operación diaria

- Actions: revisar la última ejecución de fotos y su artefacto. Una ejecución
  verde puede contener advertencias de archivos sin ID o dañados; revisarlas.
- Vercel: comprobar que el despliegue servido corresponde al commit previsto.
- Proxy: comprobar `/status` autenticado y su antigüedad; investigar refrescos
  fallidos en lugar de ampliar timeouts.
- Supabase: vigilar errores, uso de Storage, cuotas y respaldos.
- Facturación/DNS: mantener medio de pago y responsables vigentes. Una alerta
  de gasto no detiene cargos ni sustituye una política de presupuesto.

## Recuperación de incidentes

### Herramientas administrativas de uso manual

Estas herramientas no forman parte de build, desarrollo ni revisión diaria:

| Herramienta | Precaución al operarla |
| --- | --- |
| `scripts/configure-drive-github.ts` | Escribe secretos en el repositorio fijado en el script. Revisar destino y credencial antes de usar tras una transferencia. |
| `scripts/configure-image-id-service.ts` | Escribe la configuración privada del servidor indicado explícitamente en el entorno; conserva copia y política, sin reiniciar el proceso. |
| `scripts/probe-erp-from-droplet.ts` | Diagnóstico de solo lectura con host/ruta SSH del montaje original; revisar destino antes de reutilizar. La opción de exportación genera datos privados. |
| `ops/droplet/configure-reserved-egress.sh` | Modifica Netplan y cloud-init; requiere red revisada, respaldo y acceso a consola de recuperación. Un fallo de verificación final no revierte automáticamente la red. |
| `ops/droplet/harden-ssh.sh` | Desactiva accesos SSH; comprobar antes acceso por llave y sudo con el usuario de soporte. |
| `ops/droplet/bootstrap.sh` | Preparación inicial con cambios de usuario, sudo, swap y logs. No es un instalador general para cualquier servidor. |

Los respaldos privados y exportaciones de diagnóstico permanecen fuera de Git.
Un cambio del archivo de servicio a intérprete de entorno virtual requiere
instalar ese entorno antes de sustituir o reiniciar un servicio existente.

### Respuesta a fallos

**Despliegue web fallido:** mantener o recuperar el último despliegue sano;
revisar errores de build y conectividad del catálogo. No publicar precios ni
productos ficticios para que el build pase.

**Servidor perdido:** seguir la [guía DigitalOcean](digitalocean-rebuild.md),
restaurar configuración desde respaldo privado y verificar salida hacia ERP.
La IP nueva debe ser autorizada por el proveedor si cambia.

**Publicación de fotos parcial:** conservar fuentes, intentos y relaciones;
reintentar de forma idempotente. No vaciar tablas, borrar objetos ni eliminar
bloqueos sin revisar su estado. Ver la [guía de Drive](google-drive-product-images-automation.md).

**Fallo de pago:** verificar firma, modo de prueba, moneda, importe y estado en
la pasarela. La página de retorno no permite marcar pedidos pagados. No enviar
webhooks artificiales contra pedidos reales para probar la integración.
