# HU-7.03 — Internacionalización y selección de idioma de la interfaz

> **Estado:** Implementación completa; PR pendiente · **Ticket:** [MAP-240](https://matiasmv2005.atlassian.net/browse/MAP-240) · **Épica:** MAP-10 — E07 Adaptación a Verticales

## Enunciado

Como usuario de MapIt, quiero utilizar la interfaz en el idioma disponible que me resulte adecuado para comprender las opciones, validaciones y estados de la aplicación.

## Contexto

Console y Public Web ya tienen catálogos centralizados `STRINGS`, pero solo contienen español y no existe selección ni persistencia de idioma. La historia cubre la selección y las cadenas de interfaz; la terminología específica de cada vertical sigue perteneciendo a HU-7.01 / MAP-234.

El catálogo exacto de esta implementación se confirmó con el usuario el 2026-10-27: español, inglés y japonés. La issue no incluye un documento de rúbrica; por tanto, esta lista queda documentada como decisión explícita del usuario y no como verificación independiente de la rúbrica.

## Alcance

- Selector de idioma compartido por Console y Public Web para los idiomas confirmados por la evaluación.
- Catálogo tipado y reutilizable para la preferencia, con persistencia local y fallback explícito a español.
- Traducciones de las cadenas visibles existentes en Console y Public Web: navegación, vistas, formularios, validaciones, errores, éxitos, estados vacíos y flujo público de reservas.
- Actualización de `lang` del documento y formato de fecha/número de las superficies incluidas cuando dependa del idioma.
- Diseño responsive y accesible para escritorio y móvil.
- Independencia respecto del Tenant, su vertical, permisos, reglas de reserva y términos funcionales definidos por vertical.

Fuera de alcance: cambios de backend, contrato API, esquema de base de datos, selección de Tenant o traducción/adaptación de terminología definida por vertical en HU-7.01.

## Catálogo de evaluación

- Idiomas/códigos admitidos: español (`es`), inglés (`en`) y japonés (`ja-JP`).
- Idioma predeterminado y fallback: español (`es`).
- No se expondrán opciones fuera del catálogo confirmado para esta implementación.

## Criterios de aceptación

- [x] **CA-1:** Dado un usuario en Console o Public Web, cuando elige un idioma del catálogo confirmado, entonces las cadenas de interfaz de las vistas incluidas se muestran en ese idioma.
- [x] **CA-2:** Dado que el usuario seleccionó un idioma, cuando navega o recarga la misma aplicación, entonces la preferencia se conserva.
- [x] **CA-3:** Dada una traducción ausente o una preferencia persistida inválida, cuando se resuelve la cadena o se inicia la aplicación, entonces se usa español (`es`) de forma consistente.
- [x] **CA-4:** Dadas las vistas incluidas, cuando se inspeccionan cadenas visibles y accesibles, entonces proceden de catálogos centralizados; las cadenas comunes y el selector compartidos no se duplican entre aplicaciones.
- [x] **CA-5:** Dado un Tenant con vertical, cuando el usuario cambia el idioma, entonces el Tenant, vertical, permisos, términos funcionales definidos por la vertical y reglas/payload de reserva conservan el mismo valor.
- [x] **CA-6:** Dado un viewport de escritorio o móvil, cuando el usuario encuentra y usa el selector, entonces el control sigue siendo accesible, visible y no introduce desbordamiento horizontal.
- [x] **CA-7:** Cuando se ejecutan las verificaciones frontend aplicables, entonces lint, tipos, pruebas y builds terminan correctamente.

## Datos y seguridad

- La preferencia se guarda localmente en el navegador por origen; no se envía al backend ni se agrega al JWT o a las peticiones de reserva.
- No se añaden tablas ni migraciones.
- El cambio de idioma solo modifica la presentación y el formato local de datos mostrados.
