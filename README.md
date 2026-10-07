# Tiendas Big Bang · Ecommerce

Tienda de piñatería, juguetería, disfraces y decoración. El catálogo se consulta
en el ERP del negocio; las fotografías se optimizan desde Google Drive y se
almacenan en Supabase. La aplicación se despliega en Vercel.

## Arquitectura

| Componente | Función | Código |
| --- | --- | --- |
| Next.js, React y TypeScript | Catálogo, ficha, carrito y checkout | `app/`, `components/`, `lib/` |
| Proxy Python en DigitalOcean | Lectura de la vista MariaDB y caché del catálogo | `ops/catalog-proxy/` |
| Supabase | Complementos del producto, galerías, pedidos y Storage | `lib/supabase/`, `supabase/` |
| GitHub Actions + Google Drive | Revisión diaria de INVENTARIO y publicación de fotos | `.github/workflows/`, `scripts/product-images/` |
| ePayco | Pago y confirmación firmada en el servidor | `lib/pagos/`, `app/api/pagos/` |

Los originales de productos y los secretos **no forman parte del repositorio**.
`public/` contiene recursos de interfaz y marca; las fotos de productos viven
en el bucket `productos` de Supabase.

## Desarrollo local

1. Instalar Node.js 22.19 o posterior y la versión de pnpm indicada en `package.json`.
2. Clonar este repositorio privado y ejecutar `pnpm install --frozen-lockfile`.
3. Copiar `.env.example` a `.env.local` y solicitar las credenciales por el
   canal privado del equipo. El ejemplo no contiene claves reales.
4. Ejecutar `pnpm dev` y abrir la dirección que indique Next.js.

El catálogo necesita el proxy accesible y una API key válida; no existe un
catálogo ficticio de producción. El build también necesita conectividad con
el catálogo para generar los sitemaps. La instalación, pruebas y desarrollo
no aplican migraciones ni publican fotos automáticamente.

## Verificaciones

```sh
pnpm test
pnpm test:fotos
pnpm test:schema
pnpm typecheck
pnpm lint
pnpm lint:fotos
pnpm build
pnpm build:verify
```

Las pruebas Python del proxy se ejecutan en un entorno aislado con las
dependencias de `ops/catalog-proxy/requirements.txt`; las instrucciones están
en [su guía](ops/catalog-proxy/README.md). Las pruebas usan datos sintéticos.
`pnpm smoke:catalogo` consulta el catálogo real en modo lectura.

`pnpm build:verify` comprueba el build con servicios locales y datos sintéticos,
en un directorio separado. Permite detectar errores de código sin credenciales
ni red de producción; no acredita disponibilidad ni configuración de los
servicios reales. `pnpm test:schema` usa una base efímera aislada, no Supabase remoto.

## Reglas que se conservan

- `id_item` es texto y conserva sus ceros iniciales.
- Categorías, precios y descripciones proceden del ERP; el mapa de familias
  está en `lib/catalogo/familias.ts`. Las categorías sin mapa requieren revisión.
- El stock aún llega como `null`; no implica que el producto esté agotado.
- Los filtros de negocio de `lib/catalogo/index.ts` mantienen su configuración.
- La política provisional de precios se documenta en la [guía del proxy](ops/catalog-proxy/README.md).
- Las fotos se asignan por ID, con portada en orden 1. Solo se procesa la raíz
  de INVENTARIO. Borrar un original de Drive no borra automáticamente la foto web.
- Los totales se recalculan en el servidor y el número de pedido se genera en
  PostgreSQL. El retorno del navegador no confirma un pago.

## Seguridad y entrega

`CATALOGO_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, claves privadas de pago y
`ORDER_ACCESS_SECRET` son exclusivamente del servidor. Las tablas de pedidos
no tienen lectura pública. La confirmación requiere una autorización del
pedido guardada en una cookie del mismo navegador; el número consecutivo por
sí solo no permite leer datos personales.

Para entregar o transferir el proyecto, seguir la [guía de entrega y operación](docs/handoff-and-operations.md).
Incluye servicios, accesos, recuperación y dependencias de la automatización.
Mantener el repositorio privado permite compartirlo con colaboradores
autorizados sin exponer documentación interna ni todo su historial.

Los avisos pendientes o mitigaciones de dependencias se registran en
[seguridad de dependencias](docs/DEPENDENCY_SECURITY.md), con su alcance y evidencia.

## Organización

```text
app/                  Páginas, rutas de servidor y checkout
components/           Componentes de interfaz
lib/                  Catálogo, carrito, seguridad, pagos y Supabase
scripts/              Importadores, pruebas y herramientas operativas
ops/                  Proxy y preparación del servidor
supabase/             Esquema de reconstrucción y migraciones
docs/                 Guías vigentes; evidencia fechada en docs/archive/
_data/                Fuente y documentación del mapa de categorías
_design-reference/    Referencias de diseño, no servidas en producción
public/               Marca, recursos de interfaz y placeholders
```

[Índice de documentación](docs/README.md) ·
[Instrucciones de fotos para el equipo](docs/drive-instructions-for-team.md) ·
[Automatización de Drive](docs/google-drive-product-images-automation.md)
