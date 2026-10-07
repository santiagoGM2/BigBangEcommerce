# Proxy del catálogo ERP

El proxy Python expone el contrato del ecommerce a partir de una vista MariaDB
con permisos de lectura. Las consultas no modifican el ERP. El servicio HTTP
escucha en `127.0.0.1:8080`, detrás de nginx con HTTPS.

## Contrato y reglas vigentes

`catalog.py` produce exactamente nueve campos: `id_item`, `referencia`,
`descripcion`, `categoria`, `codigo_barra`, `precio`, `precio_fuente`,
`existencias`, `activo`.

- `ID_ITEM` siempre texto; conserva ceros iniciales.
- Categoría: `DESCRIPCION_LINEA2`; precio: `PRECIO_MIN_1`.
- Política provisional autorizada: lista `001` pública, `002` de respaldo,
  precio final con impuestos incluidos. La confirmación comercial del proveedor
  sigue pendiente; no cambiar esas reglas durante mantenimiento técnico.
- `PRECIO_SUG_1/2` no se utilizan. Stock permanece `null`; no se filtran inactivos.
- Una descripción vacía se omite con aviso. No se inventan descripciones,
  precios cero ni una elección arbitraria entre filas duplicadas por ID/lista.

`public_catalog.py` conserva una instantánea completa y comprimida en memoria
con TTL de seis horas. Un refresco fallido conserva la última válida y reintenta
al minuto. El endpoint de IDs consulta la vista antes de cada lote: no devuelve
IDs antiguos si esa consulta falla.

## Endpoints de esta implementación

Todos requieren el header privado `x-api-key`.

| Endpoint | Función |
| --- | --- |
| `GET /productos` | Catálogo normalizado desde memoria, admite gzip |
| `GET /producto-ids` | IDs reales de la vista, independientes de precios |
| `GET /status` | Estado, antigüedad y último fallo del catálogo |
| `POST /refrescar` | Solicita refresco del catálogo |

`/productos` requiere `pricePolicy`; sin ella responde 503. El código versionado
no expone `/catalogo`; las consultas crudas de diagnóstico se realizan mediante
las herramientas de operación autorizadas, sin incorporarlas al sitio.

## Entorno reproducible y pruebas

Desde la raíz del repositorio, con Python 3.12 o posterior:

```sh
python -m venv .venv
.venv/bin/python -m pip install -r ops/catalog-proxy/requirements.txt
.venv/bin/python -m unittest discover -s ops/catalog-proxy -p 'test_*.py' -v
```

En Windows usar `.venv\Scripts\python.exe` en lugar de `.venv/bin/python`.
Las pruebas de permisos POSIX y enlaces se ejecutan en Linux y se omiten
explícitamente en Windows. Todas las pruebas usan dobles locales y datos
sintéticos; no se conecta al ERP ni se modifica el servidor.

## Instalación en un servidor nuevo

1. Preparar el usuario `bigbang`, firewall y acceso SSH según la
   [guía de infraestructura](../../docs/digitalocean-rebuild.md).
2. Copiar los módulos de esta carpeta a `/opt/bigbang/`, propiedad de root y
   legibles por el servicio. Crear `/opt/bigbang/.venv` e instalar
   `requirements.txt` en ese entorno con Python 3.12.
3. Instalar `bigbang-image-ids.service`. Su intérprete debe apuntar a
   `/opt/bigbang/.venv/bin/python`; comprobar que exista antes de iniciar.
4. Restaurar `/etc/bigbang/catalog-config.json` desde el respaldo privado,
   permisos `root:bigbang 0640`; directorio `0750`.
5. Configurar nginx y un certificado válido, iniciar el servicio y verificar
   los endpoints autenticados. Revisar estado y registros sin imprimir claves.

El archivo de configuración tiene `host`, `port`, `user`, `password`, `database`,
`view`, `apiKey`, `allowPlaintext` y `pricePolicy` con las claves `public_list`,
`fallback_list`, `includes_taxes`. No se almacena una copia con valores reales
en Git. La excepción `allowPlaintext: true` está autorizada solo para MariaDB;
no deshabilita validación de HTTPS ni la huella SSH.

## Actualización segura de credenciales

`scripts/configure-image-id-service.ts` lee `.env.local` y exige destino explícito
`ERP_PROXY_SSH_TARGET` (`usuario@host`) y `ERP_PROXY_SSH_KEY_PATH` (ruta absoluta).
La huella del servidor debe estar previamente verificada en `known_hosts`.
Es una operación administrativa manual, no un paso de build ni de instalación.

El script envía las credenciales por stdin cifrado de SSH. `update_config.py`:

- Valida puerto, vista, API key, autorización y política de precios existente.
- Conserva `pricePolicy` y todos los campos no incluidos en la actualización.
- Rechaza una configuración inválida, enlaces simbólicos o una operación simultánea.
- Guarda el archivo anterior íntegro en `catalog-config.json.backup`, permisos
  `0600`, antes de reemplazar el activo atómicamente con `0640` y fsync.
- Una repetición idéntica no reescribe ni pierde la copia anterior.
- No reinicia el servicio ni imprime credenciales.

Si se usa sobre un servidor sin configuración, inicia únicamente el servicio de
IDs; la política comercial se restaura/configura por separado antes de habilitar
el catálogo público. Una interrupción puede dejar `.catalog-config.json.lock`:
verificar que no haya operación activa antes de retirarlo. Una respuesta SSH
perdida requiere comprobar el archivo y la copia; no implica que no se escribió.

Después de una actualización confirmada, reiniciar el servicio en una ventana
controlada y comprobar `/status` y `/productos`. Para volver atrás, restaurar la
copia privada con los mismos permisos y verificar el servicio. Mantener también
un respaldo cifrado fuera del Droplet: la copia local no protege de su eliminación.
