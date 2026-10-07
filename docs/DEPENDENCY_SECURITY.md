# Seguridad de dependencias

Revisión: 7 de octubre de 2026. Las comprobaciones describen las versiones
fijadas en `pnpm-lock.yaml`; no garantizan que nunca aparezcan nuevas alertas.

## Versiones y entorno

- Node.js **22.19 o superior**. El mínimo viene de Undici 8.11.2. CI usa la
  rama 22; la verificación local se ejecutó con Node 22.23.3.
- pnpm **11.18.0**, declarado en `packageManager`.
- Next.js y eslint-config-next **16.4.0**; React y React DOM **19.3.0**.
- Sharp **0.35.5**, Undici **8.11.2**.
- Supabase JS **2.111.0**, fijado sin rango para no introducir cambios
  inesperados en acceso a datos. No fue necesario cambiar esta API.
- PGlite **0.5.8** se usa solo en las pruebas locales del esquema.

Las actualizaciones mantienen las versiones mayores de la aplicación. El
lockfile y los límites de versiones transitivas conservan las correcciones de
PostCSS, nanoid, source-map-js y brace-expansion. No hay excepciones a la
política de antigüedad de paquetes ni exclusiones globales de auditoría.

## Resultado y excepción mitigada

`pnpm audit --prod`: **ninguna vulnerabilidad conocida** en las dependencias
de producción según el registro consultado.

La auditoría integral todavía identifica **una alerta de desarrollo**:
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
desbordamiento de pila por anidación profunda en `braces@3.0.3`. Llega por
`eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch`.
No procesa entradas de compradores en la aplicación.

Aunque la respuesta de npm audit sugiere `>=3.0.4`, esa versión **no está
publicada** en el registro al revisar. El aviso de GitHub también indica que
no existe una versión corregida. No se declara una actualización inexistente.

Se aplica un parche local, versionado en
[`patches/braces@3.0.3.patch`](../patches/braces@3.0.3.patch), mediante
`patchedDependencies` de pnpm. Limita la anidación a 100 niveles en el parser
y en los recorridos de compilación, expansión y serialización del AST. Las
entradas excesivas fallan pronto con un error controlado; patrones normales,
rangos y caracteres escapados mantienen su comportamiento. No cambia los
filtros, nombres o reglas del catálogo ni de las fotos.

### Cómo se comprueba

```sh
pnpm test:quality
pnpm audit:dependencies
pnpm audit --prod
```

`audit:dependencies` ejecuta la auditoría **completa**, imprime la alerta
mitigada y falla ante cualquier otra alerta o error de consulta. Solo admite
este aviso en la versión y cadena de desarrollo indicadas; comprueba el hash
del parche y ejecuta ataques de regresión sobre la copia real usada por
ESLint. También prueba AST proporcionados directamente y patrones de 8.003
caracteres, dentro del límite de longitud de la librería.

La salida esperada es **0 alertas sin resolver y 1 mitigada localmente**.
El comando original `pnpm audit` seguirá devolviendo la alerta y un código de
salida distinto de cero porque identifica la versión, no inspecciona el parche.
No debe describirse ese resultado como una auditoría integral con cero alertas.

Cuando exista una corrección oficial, actualizar `braces`, retirar su parche,
revisar `scripts/quality/` y volver a ejecutar todas las comprobaciones. No
ampliar la excepción automáticamente a otras versiones, dependencias o avisos.

## Avisos de compatibilidad de ESLint

Se conserva **ESLint 10.12.0**, con soporte vigente, y `@eslint/compat` en la
configuración. Los plugins `eslint-plugin-import`, `eslint-plugin-react` y
`eslint-plugin-jsx-a11y` aún declaran compatibilidad hasta ESLint 9. Por eso
pnpm muestra avisos de peer dependencies. No se silencian estos avisos ni se
regresa a ESLint 9, que el registro marca como fuera de soporte.

La ejecución completa de lint debe pasar con cero errores. Los avisos de
versiones declaradas por terceros no equivalen a fallos de lint del proyecto;
revisarlos de nuevo al actualizar los plugins. `node-domexception@1.0.0`
también aparece como dependencia transitiva obsoleta de la librería de Google;
la auditoría no le atribuye una vulnerabilidad conocida.

## Mantenimiento

La automatización `Calidad del repositorio` valida cada pull request y los
cambios de `main`, con permisos de lectura y sin secretos de producción.
Incluye auditoría, lint, TypeScript, aplicación, fotos, proxy, esquema y build
con servicios locales de prueba. Las acciones de GitHub están fijadas a un
commit para que una etiqueta cambiante no altere la ejecución revisada.

Actualizar dependencias con un pull request dedicado, revisar el lockfile y
ejecutar la batería completa antes de publicar. No usar actualizaciones
forzadas de versiones mayores para hacer desaparecer avisos.
