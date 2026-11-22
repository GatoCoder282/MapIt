# ADR-0013 — Frontend API de Unleash en los entornos desplegados

- **Estado:** Aceptado (complementa [ADR-0005](ADR-0005-feature-toggles.md))
- **Fecha:** 2026-11-22
- **Deciden:** equipo MapIt

## Contexto

ADR-0005 decidió que el navegador nunca habla con el servidor de Unleash sino con
`unleash-proxy`, para no exponer el catálogo completo ni el token admin. En local el proxy corre en
Docker Compose. Al desplegar en Render free, un proxy sería un cuarto servicio que consume horas
gratuitas y duerme por separado.

Unleash v6 incluye la **Frontend API** (`/api/frontend`): devuelve solo los flags evaluados para el
contexto del usuario, se autentica con un token de tipo _frontend_ (público por diseño, limitado a
un entorno) y respeta la lista de CORS origins del servidor. Usa el mismo contrato que el proxy, así
que `@mapit/feature-flags` la consume sin cambios.

## Decisión

- **Local**: se mantiene `unleash-proxy` (`:3063`), como en ADR-0005.
- **Desplegado**: el navegador usa la Frontend API del servidor Unleash
  (`https://<unleash>/api/frontend`) con un token _frontend_ por entorno (`production` para prod,
  `development` para QA). `tools/scripts/frontend-config.mjs` lo publica en `config.json` desde
  `UNLEASH_FRONTEND_URL` y `UNLEASH_FRONTEND_TOKEN`, y rechaza tokens admin.
- El backend usa la API de cliente (`/api`) con un token _backend_ del mismo entorno.
- Unleash OSS solo trae los entornos `development` y `production`: QA usa `development`.

## Alternativas consideradas

| Opción                     | Por qué no                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------- |
| Desplegar `unleash-proxy`  | Un servicio más en Render free sin beneficio frente a la Frontend API integrada.   |
| Unleash Edge               | Pensado para alto tráfico y varios entornos; sobredimensionado para este proyecto. |
| Flags fijos en el frontend | Contradice el requisito: apagar una funcionalidad en caliente sin redesplegar.     |

## Consecuencias

- El token frontend viaja al navegador; solo permite leer flags evaluados de su entorno.
- El servidor Unleash queda expuesto a internet: la contraseña de `admin` se cambia en el primer
  arranque y los tokens admin nunca salen del panel.
- La Frontend API devuelve solo los flags **encendidos**: un flag apagado se interpreta con el
  default del catálogo. Los flags con default `true` no se pueden apagar desde el navegador hasta
  corregir esa interpretación (pendiente, fuera de este ADR).
