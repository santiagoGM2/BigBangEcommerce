# Reconstruccion del proxy del catalogo con limite de USD 4/mes

Estado actualizado 2026-10-01: Team, Droplet y red operativos. El propietario
autorizo expresamente conectar el ERP sin TLS. Desde el Droplet se autenticaron
las credenciales y se leyo la vista original: 25.961 filas, 15.888 IDs distintos,
45 columnas, dos listas de precios. La IP autorizada sigue siendo 137.184.240.13.
La excepcion se limita a MariaDB, con ERP_DB_ALLOW_PLAINTEXT=true explicito;
HTTPS, SSH y validacion de certificados de los otros servicios se mantienen.
No se escribio en el ERP. Los parrafos inferiores sobre el bloqueo por TLS
registran el diagnostico anterior a esta autorizacion.

Pendiente para reconstruir el proxy: confirmar que lista 001 es publica y
PRECIO_MIN_1 ya incluye impuestos. Oscar confirmo por escrito el 2026-10-01 que
PRECIO_SUG_1/2 no se usan actualmente; la captura senala PRECIO_MIN_1 como
campo de venta. El propietario aun no conoce el rol de las listas ni si el
valor incluye impuestos. La transformacion preparada en ops/catalog-proxy/
exige una politica explicita y no se ha activado. Siete pruebas pasan en el
Droplet (sin consultas ERP en esas pruebas). Ese es el unico campo con valores
positivos en las 25.961 filas. Categoria: DESCRIPCION_LINEA2. Existencias no
aparecen en la vista y se mantienen null conforme al contrato existente.
Auditoria de fotos: docs/erp-photo-identifiers-20261001.md.
DigitalOcean confirmo en el ticket 12858422 que, tras el impago y los avisos,
elimino el Droplet anterior (ID 583474440) y sus datos. No puede recuperarlos.
No hay backups ni snapshots visibles. El nuevo proxy se reconstruira desde
codigo versionado.

## Organizacion de la cuenta

- Team dedicado `Tiendas Big Bang`, creado el 2026-09-30.
- Correo del Team verificado: `santiagogomez3186@gmail.com`.
- Contacto de seguridad: `santiagogomez3186@gmail.com`, estado `Verified`
  comprobado en DigitalOcean el 2026-09-30.
- Miembro tecnico actual: `santiago.gomez_mol@uao.edu.co` como `Owner`.
- Cuenta de respaldo: `santiagogomez3186@gmail.com`, invitada como `Member`,
  aceptada y ascendida a `Owner` el 2026-09-30. El propietario institucional
  confirmo el cambio mediante el correo de DigitalOcean. El panel muestra
  `Owner` y `Joined Google`. Este correo tambien esta verificado como contacto
  de seguridad.
- Encargada de pagos: `bigbang.marisol@gmail.com`, invitada como `Biller` el
  2026-10-01. El panel muestra `Pending`: falta que acepte la invitacion.
  Puede registrar una tarjeta sin acceso a los recursos tecnicos.
- El proyecto predeterminado vacio fue renombrado a `Ecommerce y catálogo`,
  con proposito `Service or API`, entorno `Production` y descripcion del proxy.
  Contiene el Droplet del proxy del catálogo.

Un Project solo organiza recursos; los roles y la facturacion pertenecen al
Team. El Team nuevo no heredo la tarjeta del Team antiguo `My Team`. El
propietario registro una tarjeta personal temporal el 2026-09-30 y DigitalOcean
la muestra como metodo principal. El propietario autorizo expresamente crear
el Droplet antes de contar con la tarjeta del negocio. La encargada de pagos
ya esta invitada. La tarjeta del negocio debe agregarse y establecerse como
principal; solo entonces se puede eliminar la personal. No se le pediran datos
de tarjeta por chat.

DigitalOcean muestra un credito de registro de USD 5 para Inference Cloud
Trial. No se ha confirmado que cubra Droplets; no se contara con ese credito
para presupuestar el proxy. El Droplet empezo a facturarse al crearse el
2026-09-30, a USD 0.006 por hora, con maximo base de USD 4 por mes completo.

Se creo una alerta de gasto mensual llamada `Tiendas Big Bang - limite objetivo
USD 4`, con avisos al 50 %, 75 % y 100 % del presupuesto de USD 4. Se
comprobo que permanece en el listado tras recargar la pagina. La alerta
notifica; no impone un tope ni detiene automaticamente los recursos. DigitalOcean
revisa el gasto cada hora y dirige estos avisos a Owners y Billers.

## Infraestructura creada

| Recurso | Configuracion | Costo previsto |
| --- | --- | --- |
| Droplet `bb-catalogo-proxy-prod-01` (ID `605098640`) | Basic Shared CPU, 1 vCPU, 512 MB RAM, 10 GB SSD | USD 4/mes |
| Region | NYC1, igual a la anterior | Incluida |
| Sistema | Ubuntu 24.04 LTS x64 | Incluido |
| IPv4 publica | `204.48.26.102`, para SSH y trafico de entrada | Incluida |
| Reserved IPv4 | `137.184.240.13`, asignada y comprobada como salida | Gratis mientras asignada |
| Monitoreo basico | Agente gratuito de DigitalOcean activado | Gratis |
| Backups de DigitalOcean | Fuera del limite estricto de USD 4 | No activar |

El precio del Droplet no incluye impuestos ni eventuales excesos de
transferencia. Una IP reservada desasignada si puede generar cargos; si se
destruye el Droplet, hay que reasignarla inmediatamente o eliminarla.

La IP reservada no era la IP de salida por defecto: inicialmente salia por
`204.48.26.102`. Se cambio la ruta predeterminada al gateway de anclaje
`10.10.0.1` en Netplan y se desactivo la reescritura de red de cloud-init.
Tras reiniciar, `api.ipify.org` volvio a ver `137.184.240.13`. Esa es la IP
que se debe autorizar en el ERP. La configuracion original de Netplan queda
en `/etc/netplan/50-cloud-init.yaml.original` en el servidor.

Se creo el firewall gratuito `bb-catalogo-proxy-prod-fw` (ID
`193810ab-d501-4134-897f-6ca75c6b01d9`), aplicado al unico Droplet:
SSH/22 solo desde la IP administrativa observada el 2026-09-30
(`186.27.168.189/32`); HTTP/80 y HTTPS/443 desde Internet; salida ICMP/TCP/UDP
permitida. Si cambia la IP del administrador, debe actualizarse esa regla
desde el panel de DigitalOcean antes de volver a usar SSH.

Se creo el usuario `bigbang` con `sudo`, acceso por llave y sin contraseña de
SSH. Se deshabilitaron el inicio SSH directo como root y la autenticacion por
contraseña. El servidor tiene 1 GB de swap y limite de 100 MB para journald;
los paquetes se actualizaron y `unattended-upgrades` esta activo. Los scripts
reproducibles de preparacion estan en `ops/droplet/`. La llave de administracion
local esta en `~/.ssh/bigbang-do-admin` y solo permite acceso por el origen SSH
autorizado. Nunca se guarda en Git.

El agente `do-agent` esta activo. Hay dos alertas gratuitas de recursos para
este Droplet, dirigidas tanto al Owner institucional como al correo operativo
`santiagogomez3186@gmail.com`: memoria superior al 80 % durante 5 minutos y
disco superior al 80 % durante 30 minutos. La alerta mensual de gasto a
USD 4 sigue vigente por separado.

El Droplet de 512 MB correra solamente el proxy del catalogo, HTTPS y sus
servicios indispensables. La conversion de fotografias, especialmente HEIC,
correra diariamente en GitHub Actions para no agotar su RAM. GitHub Actions y
Supabase tienen cuotas propias que se deben vigilar.

## Conexion con el ERP

La captura enviada por el propietario corresponde a una vista de MariaDB de
solo lectura con IDs, referencias, descripciones, listas de precio, barras y
lineas. El puerto del ERP acepto una conexion TCP desde este equipo el
2026-09-30. Esto solo prueba conectividad de red; no valida autenticacion,
permisos de SELECT, vigencia de la vista ni acceso desde una IP nueva.

El propietario indica que Oscar no cambio la vista ni la cuenta de solo
lectura. La prueba local con la credencial recibida llego a MariaDB, pero
respondio `ER_HOST_NOT_PRIVILEGED`: esta IP de origen no esta autorizada.
Desde el nuevo Droplet se comprobo una respuesta MariaDB 1130:
`Host '137.184.240.13' is not allowed to connect to this MariaDB server`.
La prueba no transmitio usuario ni contraseña; confirmo el bloqueo anterior
por lista de origenes del ERP, sin evaluar TLS.
El 2026-10-01, despues de que Oscar autorizo el acceso, la misma IP obtuvo
el saludo de MariaDB `10.11.9` y se confirmo que la salida continua siendo
`137.184.240.13`. Esto acredita conectividad, no autenticacion ni SELECT.
Una negociacion TLS con `openssl s_client -starttls mysql` respondio
`MySQL server does not support SSL.` No se envio la credencial por ese canal.
Antes de consultar la vista, el proveedor debe ofrecer TLS con certificado
verificable (y su CA, si es privada) o un tunel/VPN cifrado hasta el ERP.
El registro A de `api.tiendasbigbang.com` todavia resolvia a la IP antigua
`159.89.86.21` el 2026-09-30. No se cambio el DNS: todavia no hay proxy nuevo
desplegado ni certificado HTTPS para ese dominio. Tampoco se modifico Vercel.
No se pudo comprobar todavia la contrasena ni la vista. `pnpm probe:erp` realiza
una conexion MariaDB con TLS validado, comprueba SELECT y lista solo nombres y
tipos de columnas. Requiere `ERP_DB_*` en `.env.local`; no imprime filas ni
credenciales. El cliente HTTPS del proxy antiguo sigue fallando en TLS porque
el Droplet fue destruido; esto no permite concluir nada sobre la vista.

La IP nueva ya esta autorizada. Para terminar la comprobacion se pedira a Oscar:

1. Confirmar o restablecer la vista y la cuenta de solo lectura si la prueba
   directa falla.
2. Aclarar el significado de las columnas necesarias, incluidas las listas
   de precio y categorias, para reproducir exactamente el contrato de nueve
   campos que consume Next.js.
3. TLS en MariaDB con certificado verificable y CA si es privada, o acceso
   mediante VPN/tunel SSH cifrado. La conexion actual no anuncia TLS.
4. Rotacion de la contraseña compartida en una captura; el nuevo valor se
   entregara por un canal seguro y no se guardara en Git.

El viejo proxy no aparece en este repositorio ni en otros archivos locales
encontrados bajo `C:\dev`. Si existe una copia, debe reutilizarse y auditarse;
si no, se implementara otra vez en codigo versionado con pruebas sobre el
contrato actual.

## Orden de puesta en servicio

1. IP de salida `137.184.240.13` autorizada en MariaDB el 2026-10-01.
2. Obtener un canal cifrado verificable hacia MariaDB; entonces probar la vista
   con `pnpm probe:erp` a traves del Droplet y revisar tipos, columnas, filas y
   reglas de precio sin escribir.
3. Reconstruir el proxy desde codigo, con secretos solo del lado del servidor.
4. Probar conexion de solo lectura, transformacion del catalogo y endpoints
   autenticados `/status`, `/productos`, `/catalogo` y `/refrescar`.
5. Configurar HTTPS, dominio y DNS; comprobar desde fuera del servidor.
6. Verificar que Next.js en Vercel puede obtener el catalogo real.
7. Ejecutar el dry-run de fotos y continuar con la automatizacion diaria.
8. Verificar que la encargada de pagos acepte la invitacion `Biller`. Ella
   agrega la tarjeta del negocio y la establece como principal; despues se
   elimina la tarjeta personal temporal.

La reconstruccion del proxy no escribe en el ERP. La tarea de fotos obtuvo
autorizacion posterior para publicar: el 2026-10-01 se aplicaron las migraciones
de galeria y seguimiento en Supabase, sin subir fotos. Sus pruebas SQL se
revirtieron. La carga sigue bloqueada hasta validar IDs contra el catalogo real.
