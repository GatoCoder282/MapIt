# Plan — HU-7.08 Observabilidad operativa y salud de tenants

## Enfoque

`platform` lee proyecciones SQL que **solo** devuelven agregados. La infraestructura fija el
contexto RLS de una empresa por transacción y la aplicación aplica la supresión antes de que el
dato salga del caso de uso, de modo que el controlador nunca ve un valor que deba ocultarse.

## Patrones de diseño aplicados

| Patrón             | Dónde                                      | Por qué aquí                                                            | Alternativa descartada                                                   |
| ------------------ | ------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Projection         | `TenantMetricsReader`                      | Solo salen conteos; no existen filas brutas que filtrar                 | Reutilizar repositorios de reservas: devuelven datos personales          |
| Value Object       | `GuardedCount`                             | Un valor suprimido no conserva el número: no se puede filtrar por error | Ocultarlo en la plantilla: el dato viajaría al navegador                 |
| Domain Service     | `SmallCountSuppression`                    | La regla de privacidad es pura y se prueba sin base                     | Repetirla en cada consulta SQL                                           |
| Ports and Adapters | `ApiHealthProbe` implementado en bootstrap | El dominio no conoce Micrometer                                         | Exponer `/actuator/metrics` al navegador: filtra rutas y detalle interno |

## Datos (migración V44)

`platform_access_log(id, tenant_id='platform', actor_id, occurred_at, view, subject_tenant_id)`
con RLS y permisos de solo `SELECT` e `INSERT` para `mapit_app`. Tabla propia porque son accesos
de lectura, no eventos de negocio, y así no se redefinen las restricciones de `audit_log`.

**Número de versión:** V43 está tomado por los PR #84 y #75; se usa V44 suponiendo que #84 entra
antes. Se ajusta al mergear.

## Contrato

| Método y ruta                                | Respuesta                       |
| -------------------------------------------- | ------------------------------- |
| `GET /platform/observability?days=7\|30`     | salud, totales, serie diaria    |
| `GET /platform/observability/tenants`        | página filtrable de empresas    |
| `GET /platform/observability/tenants/{slug}` | detalle agregado de una empresa |

## Verificación

Unitarias de supresión; integración con Testcontainers (rol, flag, privacidad, aislamiento,
registro de accesos); Vitest de los ViewModels; E2E de la Console con flag ON y OFF.
