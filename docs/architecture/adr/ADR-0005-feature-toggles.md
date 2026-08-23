# ADR-0005 — Feature toggles con Unleash self-hosted

- **Estado:** Aceptado
- **Fecha:** 2026-08-23

## Contexto

Requisito del docente: implementar feature toggles. El ejemplo planteado fue _"el software
funciona bien en América pero deja de funcionar en Inglaterra; el toggle permite
desactivarlo hasta depurar y arreglar el error, y luego habilitarlo"_.

Ese ejemplo es un **kill switch con constraint geográfico**: hay que poder apagar una
funcionalidad **en caliente y solo para un subconjunto de usuarios**, sin redesplegar.

## Decisión

**Unleash self-hosted** en Docker, con:

- **Servidor + UI** en `:4242` — se prende y apaga sin tocar código.
- **unleash-proxy** en `:3063` — el navegador habla con el proxy, **nunca** con el servidor.
  El proxy devuelve solo las flags evaluadas para ese usuario, sin exponer el catálogo
  completo ni el token de administración.
- **`FeatureFlagPort`** en el `shared-kernel` — el dominio pregunta «¿está activa esta
  funcionalidad?» sin conocer Unleash. Mismo principio hexagonal que el resto.
- **Catálogo tipado** en ambos lados: enum `FeatureFlag` en Java, tipo literal en TypeScript.
  Una errata en el nombre de una flag es un error de compilación, no un `false` silencioso.
- **Falla abierto hacia los valores por defecto.** Si Unleash no responde, la aplicación
  usa el valor por defecto del catálogo y sigue funcionando. Sería absurdo que una
  herramienta para mitigar incidentes fuera la causa de uno.

Convención: `<dominio>.<feature>`. Tipos canónicos (Fowler): `release` · `kill-switch` ·
`experiment` · `permission`.

**Higiene:** toda flag `release` nace con fecha de retiro y un issue de limpieza.
Las flags zombis son deuda técnica: cada una es una rama de código que nadie prueba.

## Alternativas consideradas

| Opción                                       | Por qué no                                                                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tabla propia en Postgres + endpoint          | Se entiende a fondo por construirlo, pero hay que escribir la UI y las estrategias (porcentaje, país, tenant) desde cero. Tiempo mejor invertido en el dominio. |
| Solo properties de Spring / `environment.ts` | Trivial, pero apagar una feature exige redesplegar — no cumple el caso de uso del docente.                                                                      |
| LaunchDarkly u otro SaaS                     | De pago y dependencia externa para un proyecto académico local.                                                                                                 |

## Consecuencias

- El ejemplo del docente se resuelve con un constraint `country != GB` en la UI, en segundos.
- Unleash es el equivalente open source de LaunchDarkly: es material real de entrevista.
- Coste: dos contenedores más (servidor + su BD) y un proxy.
- El catálogo vive en tres sitios (Java, TS, bootstrap). `pnpm new:flag` los crea a la vez
  precisamente para que no se desincronicen.
