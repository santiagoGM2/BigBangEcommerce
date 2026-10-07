# Infraestructura del catálogo en DigitalOcean

Guía operativa basada en el código y la configuración documentada. No contiene
credenciales, correos personales, datos de tarjetas ni identificadores de tickets.
La disponibilidad actual se comprueba con los endpoints y el panel del proveedor.

## Distribución de responsabilidades

- Team: **Tiendas Big Bang**. Los roles y pagos pertenecen al Team.
- Project: **Ecommerce y catálogo**. Agrupa los recursos de producción.
- Owners técnicos: administración y recuperación; al menos dos cuentas nominativas.
- Biller: persona encargada del medio de pago, sin administración del servidor.
- Mantener los contactos y el estado de invitaciones en el panel, no en Git.

El plan base documentado del Droplet es USD 4/mes (1 vCPU, 512 MB, 10 GB SSD,
Ubuntu 24.04 LTS, NYC1). Impuestos, exceso de transferencia y otros servicios
pueden generar cargos adicionales. Las alertas de presupuesto avisan; no limitan
el gasto. La configuración no activa backups de pago automáticamente.

## Red y servicio

| Elemento | Configuración documentada |
| --- | --- |
| Droplet | `bb-catalogo-proxy-prod-01` |
| API pública | `https://api.tiendasbigbang.com` |
| IP reservada del proxy | `137.184.240.13` |
| Usuario del servicio | `bigbang`, sin privilegios en el proceso HTTP |
| Servicio | `bigbang-image-ids.service` |
| HTTP interno | `127.0.0.1:8080`, expuesto mediante nginx/HTTPS |
| Configuración privada | `/etc/bigbang/catalog-config.json` |

La IP reservada debe seguir asignada y ser la salida real hacia MariaDB. Una
nueva IP requiere autorización del proveedor del ERP. El script de Netplan
`ops/droplet/configure-reserved-egress.sh` es específico de la red del Droplet:
revisar su interfaz, gateway y respaldo antes de ejecutarlo en otra máquina.
Una IP reservada desasignada puede facturarse por separado.

SSH usa llaves, acceso desde la IP administrativa autorizada y sin login directo
como root ni contraseña. El firewall permite HTTP/HTTPS públicos. Al cambiar de
red, actualizar la IP administrativa en DigitalOcean antes de conectarse.
Verificar la huella SSH por un canal confiable; no desactivar su comprobación.

El proceso tiene límite de memoria de 160 MB. La optimización de fotografías se
ejecuta en GitHub Actions, no en el Droplet de 512 MB. Los límites de Actions y
Supabase son independientes del costo del servidor.

## Conexión y reglas del ERP

El proveedor autoriza la IP de salida y una cuenta de lectura de una vista.
No se crean productos ni se escribe en MariaDB. Los nombres reales de conexión
se administran como secretos fuera del repositorio.

**Excepción vigente:** el propietario autorizó explícitamente la conexión
MariaDB sin TLS porque el servidor del proveedor no lo ofrece. La configuración
requiere `ERP_DB_ALLOW_PLAINTEXT=true`; se conserva esta decisión y no se amplía
a HTTPS, SSH ni otros servicios. Si el proveedor habilita TLS/VPN, planificar y
validar esa transición antes de cambiar el cliente.

La política comercial vigente es provisional: lista `001` pública, `002` como
respaldo y `PRECIO_MIN_1` tratado como precio final con impuestos incluidos por
indicación del propietario. La confirmación comercial del proveedor sigue
pendiente. El campo sugerido no se usa. Stock permanece `null` y no se filtra
por estado activo. Ver el [contrato del proxy](../ops/catalog-proxy/README.md).

## Reconstrucción y recuperación

1. Crear el servidor y conservar/asignar la IP reservada. Revisar la salida
   real y la autorización de lectura del ERP.
2. Preparar usuario, firewall, llaves, swap y límites con los scripts revisados
   de `ops/droplet/`. Son herramientas de administración, no pasos de desarrollo local.
3. Instalar el proxy y sus dependencias según [su guía](../ops/catalog-proxy/README.md).
4. Restaurar la configuración privada desde el respaldo del equipo. Conservar
   `pricePolicy`; el actualizador de credenciales ya no reemplaza el documento completo.
5. Configurar nginx, DNS y certificado HTTPS. Verificar la renovación del
   certificado y probar el servicio detrás del proxy.
6. Comprobar `/status`, `/productos` y `/producto-ids` autenticados; comprobar
   catálogo, categorías y una ficha desde Vercel.
7. Validar Drive mediante dry-run antes de reanudar publicación si cambió la infraestructura.

La recuperación requiere respaldos **fuera de este servidor** de configuración,
base de datos Supabase y objetos Storage. Git conserva código y esquema; no
sustituye un respaldo de pedidos, relaciones ni imágenes. No ejecutar scripts de
bootstrap indiscriminadamente sobre un servidor sano.

## Incidencias frecuentes

- **Catálogo inaccesible:** comprobar servicio, `/status`, DNS/certificado y
  lectura del ERP. No aumentar timeouts para ocultar la causa.
- **IDs sin validar:** detener la publicación; no declarar productos inexistentes.
- **Credenciales cambiadas:** usar el actualizador seguro y luego reiniciar el
  servicio en una ventana controlada; comprobar `/status` antes de cerrar.
- **Falla de facturación o eliminación del servidor:** revisar el panel y los
  respaldos disponibles. No asumir recuperación del disco por haber pagado.
