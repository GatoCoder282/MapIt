# Plan — HU-7.03 Internacionalización y selección de idioma de la interfaz

## Enfoque

Usar los catálogos `STRINGS` que ya mantienen Console y Public Web como fuente visible de texto y añadir una infraestructura compartida de idioma en `libs/`. El catálogo acordado para esta implementación es español (`es`, predeterminado/fallback), inglés (`en`) y japonés (`ja-JP`). La selección será local al origen de cada aplicación, reactiva durante la sesión y persistida en `localStorage`.

La librería compartida ofrecerá el tipo y catálogo de idiomas, lectura/escritura segura de preferencia, actualización de `document.documentElement.lang`, resolución con fallback y un selector accesible. Console/Public Web conservarán sus catálogos específicos, mientras los controles/cadenas realmente compartidos seguirán en las librerías correspondientes. La UI se cambiará por señales, sin modificar Tenant, claims, autorización, terminología vertical ni payloads.

## Patrones de diseño aplicados

| Patrón                            | Dónde                                 | Por qué aquí                                                                                                                                                 | Alternativa descartada                                                                              |
| --------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Observer mediante Angular Signals | `I18nService` y catálogos localizados | La preferencia cambia durante la sesión y las vistas usan Signals/zoneless; leer la señal al resolver una cadena vuelve a evaluar las expresiones afectadas. | `BehaviorSubject` más suscripciones manuales añadiría limpieza y estados duplicados en componentes. |

El fallback será una resolución directa y determinista de catálogo (idioma activo → español); no requiere Strategy ni una cadena configurable de estrategias.

## Arquitectura y cambios

1. Crear `libs/i18n` (`@mapit/i18n`) con `LanguageCode`, `LanguageOption`, el catálogo español/inglés/japonés, `I18nService`, el `InjectionToken`/provider de idiomas y `createLocalizedCatalog` tipado con fallback a español.
2. Añadir `LanguageSelector` reusable y accesible al `ui-kit`, documentando su dependencia unidireccional de `@mapit/i18n`. El control debe caber en los shells de Console, navegación pública y acceso/activación donde corresponda.
3. Convertir los catálogos existentes de Console, Public Web, `ui-kit` y `auth` en catálogos localizados, con las mismas claves y traducciones completas para las superficies incluidas. Mantener datos de negocio y términos de vertical independientes.
4. Instalar el provider en `apps/console/src/app/app.config.ts` y `apps/public-web/src/app/app.config.ts`; inicializar la preferencia antes del primer render, persistirla por origen y sincronizar `html[lang]`.
5. Reemplazar texto visible hardcodeado encontrado en las vistas incluidas; mantener las cadenas de estado/validación reactivas al cambiar el idioma. Usar el locale activo para el formato local de fechas/números en las pantallas que hoy fijan `es`/`es-BO`.
6. No editar backend, OpenAPI ni migraciones. No cambiar las claves o reglas de negocio asociadas al Tenant o a la vertical.

## Verificación

- Unit tests de `@mapit/i18n`: idioma por defecto, idioma persistido válido, preferencia inválida/storage bloqueado, persistencia, actualización de `lang`, resolución reactiva y fallback por cadena ausente.
- Tests de `LanguageSelector` y de las superficies Console/Public Web: opciones exactas, selección, accesibilidad/responsive, traducción de validación/error/éxito y persistencia tras reinicializar.
- Prueba de regresión del flujo de reservas que compruebe que el cambio de idioma conserva Tenant/vertical y no modifica la petición de reserva.
- E2E por flujo existente de Console/Public Web, reutilizando selectores por rol o `data-testid`; validar desktop y móvil sin depender de texto traducido.
- Ejecutar `pnpm fmt:check`, `pnpm fe:lint`, `pnpm fe:typecheck`, `pnpm fe:test`, `pnpm fe:build`, `pnpm api:check` y `pnpm check`. Ejecutar E2E aplicable si los servicios locales están disponibles.

## Riesgos

- El catálogo de Console es grande; las traducciones deben conservar placeholders, nombres de enum y nombres de vertical.
- Un valor de error guardado como texto plano puede quedarse en el idioma anterior; convertir esos estados en códigos/valores computados o resolverlos al render.
- `localStorage` puede estar bloqueado; la selección de sesión debe seguir funcionando y usar español en una sesión nueva si no se puede leer/escribir.
- La interfaz japonesa debe probarse con fuentes/fallback de sistema y viewports móviles, sin superar el presupuesto de 800 kB de Public Web.
