# CU-10 — Plan de implementación

## 1. Qué se toca

- `apps/console/src/app/features/home/home.ts` — sustituir el placeholder por el dashboard real (template + estilos + lógica de signals).
- `apps/console/src/app/core/strings.ts` — añadir claves `adminDashboardHome` (títulos, etiquetas, mensajes de error/reintento).
- No se crea nueva carpeta; no se toca `administration/dashboard` (se reutiliza como patrón de referencia, no se modifica).
- Backend: sin cambios (se consume contrato existente).

## 2. Cómo (patrones)

| Patrón                                      | Dónde se aplica | Por qué aquí                                                                                            | Alternativa descartada                                                          |
| ------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Signal store + api-client directo           | `home.ts`       | Patrón ya probado en `administration/dashboard/ui/dashboard.ts`; una feature no importa de otra feature | Crear un servicio intermedio en `features/home/data/` — YAGNI para dos llamadas |
| `forkJoin` de llamadas independientes       | `home.ts`       | Carga en paralelo de tenants y establecimientos                                                         | Secuencial — más lento, sin beneficio                                           |
| `OnPush` + `inject()`                       | `home.ts`       | Convención de consola (zoneless, signals)                                                               | Constructor injection / ChangeDetectionStrategy.Default                         |
| `@if` / `@for` y `[class.x]`                | template        | ESLint boundaries (reglas 7–9)                                                                          | `*ngIf` / `NgClass`                                                             |
| Tokens de `libs/ui-kit/styles/_tokens.scss` | estilos         | Fuente única de diseño; no hardcodear colores                                                           | Valores en px/hex sueltos en el componente                                      |

## 3. Contrato (sin cambios)

- `tenants.service.listTenants({size, status})` → `TenantPage` con `totalElements`.
- `establishments.service.listEstablishments()` → `Array<Establishment>` (conteo y distribución por `type` en cliente).
- No se toca OpenAPI ni se regenera cliente.

## 4. Tests

- `specs/CU-10-dashboard-admin-home/tasks.md` incluirá una prueba unitaria Vitest que verifique: conteos correctos, distribución por tipo, mensaje de error + reintento, y que no haya texto hardcodeado.
