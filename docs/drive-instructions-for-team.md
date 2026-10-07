# Instrucciones para subir fotos de productos

## Donde subirlas

Usar la carpeta [INVENTARIO](https://drive.google.com/drive/u/1/folders/15Nz_GHOOKbfw04s1abKMjSRzQ8RSlBjt).
Se revisan exclusivamente las fotos que estan directamente en INVENTARIO.
Las subcarpetas se ignoran; no mover alli fotos que deban publicarse. La
categoria del producto se obtiene del ERP, no del nombre de una carpeta.

## Nombres

Usar el ID_ITEM real del producto, preferiblemente con sus ceros iniciales:

| Archivo | Resultado |
| --- | --- |
| `000480.jpg` | Foto principal, posicion 1 |
| `000480 (1).jpg` | Segunda foto |
| `000480 (2).png` | Tercera foto |
| `000480-1.jpg` | Tambien significa segunda foto |

No usar descripcion, precio ni codigo de barras como sustituto del ID_ITEM.
Los IDs sin ceros iniciales se admiten cuando identifican un unico producto.
JPG, JPEG, PNG, WEBP y HEIC admitidos; tambien fotos sin extension cuyo contenido
sea uno de esos formatos. No videos, PDF ni imagenes animadas/multipagina.
Limite por archivo: 40 MiB; HEIC: 32 MiB. Preferir archivos mas pequenos.

Si dos archivos distintos solicitan la misma posicion, se conservan ambos:
el adicional recibe una posicion libre. No hace falta renombrar originales.
Para sustituir una foto, subir una nueva version del mismo archivo de Drive;
subir otro archivo con el mismo nombre agrega otra foto, no sustituye la anterior.
No cambiar el nombre de una foto ya importada para asignarla a otro producto:
esa reasignacion requiere revision.

## Cuando y como aparece en la web

La revision esta programada una vez al dia a las 03:17 de Bogota en GitHub
Actions; puede ejecutarse mas tarde por demoras del servicio. No es instantanea
ni necesita mantener un computador encendido.

Comprueba que el producto exista en la vista actual del ERP, valida la foto,
la optimiza a WEBP de hasta 1200 px en su lado mayor y publica en Supabase.
Conserva el orden y omite versiones ya importadas. No mueve ni borra originales.
Una foto fallida no detiene las demas. Los fallos quedan en el reporte.

La web mantiene un cache de catalogo y fotos de seis horas por instancia.
Una instancia ya activa puede seguir mostrando datos anteriores hasta renovar
ese cache; la primera visita tras vencerlo inicia la renovacion en segundo plano.
No se garantiza un plazo exacto de aparicion desde que se sube el archivo.
En cada categoria aparecen primero los productos con foto real; si son mas de
24, continuan en las siguientes paginas antes de los que no tienen foto.

## Prueba sencilla

1. Elegir un producto existente y confirmar su ID_ITEM.
2. Subir una foto nueva a INVENTARIO con ese ID y un sufijo libre si ya tiene fotos.
3. Esperar la revision diaria. Un administrador puede adelantarla en GitHub:
   Actions > Fotos de productos desde Drive > Run workflow > rama main >
   activar la opcion de publicar fotos validadas > Run workflow.
4. Consultar el resumen del proceso y comprobar la ficha del producto al
   renovarse el cache de la web. Una segunda ejecucion debe omitir esa foto
   si no se ha modificado.

No borrar una foto de Drive esperando que desaparezca de la web: el sistema
no borra automaticamente imagenes publicadas. Para retirarlas, pedir revision.
