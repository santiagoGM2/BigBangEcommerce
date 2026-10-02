# Transformacion del catalogo del ERP

`catalog.py` implementa el contrato de nueve campos del sitio con los nombres
comprobados en la vista real. No es todavia el servidor HTTP del proxy.

- ID_ITEM sigue siendo string, con ceros iniciales.
- Categoria usa DESCRIPCION_LINEA2.
- Precio usa PRECIO_MIN_1, confirmado por Oscar; ignora sugeridos.
- Existencias permanece null. Los productos inactivos no se filtran.
- Listas publica/respaldo e impuestos deben confirmarse expresamente.
- No se eligen filas duplicadas al azar ni se publican precios cero/inventados.

La politica 001/002 con impuestos incluidos aparece solo en datos de prueba.
No constituye confirmacion comercial ni esta habilitada en produccion.
Si los precios son netos, hace falta confirmar la formula de impuestos antes
de implementar ese modo, incluido consumo cuando corresponda.

Pruebas: `python3 -m unittest -v` desde esta carpeta.
Se ejecutaron 7/7 correctamente en el Droplet el 2026-10-01.

## Servicio de IDs independiente

`image_ids_server.py` sirve `/producto-ids` con la misma API key privada.
Consulta la vista real en una transaccion de solo lectura antes de cada lote.
Nunca publica datos antiguos si falla el ERP. `/productos` responde 503 hasta
confirmar la politica comercial, sin inventar precios.

Instalado como `bigbang-image-ids.service`, solo en 127.0.0.1:8080, detras de
nginx con HTTPS en api.tiendasbigbang.com. Configuracion privada en
/etc/bigbang/catalog-config.json (root:bigbang 0640), entregada por SSH stdin.
Memoria maxima 160 MB, usuario sin privilegios y filesystem protegido.
Certbot renueva automaticamente el certificado; DNS usa IP reservada
137.184.240.13. No se agregaron servicios de pago al Droplet de USD 4.

Pruebas del endpoint: 4/4 (autorizacion, independencia de precios, ERP fallido
y precios pendientes). Peticion HTTPS autenticada real: 15.888 IDs completos.
