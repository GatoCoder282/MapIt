# CU-10 — Dashboard de administrador en home

## 1. Contexto

La pantalla `home` de `apps/console/src/app/features/home/home.ts` es un placeholder de andamiaje: solo verifica que los feature toggles funcionan y muestra datos de sesión. No es un dashboard real.

CU-10 sustituye ese placeholder por el dashboard del administrador de plataforma: métricas de tenants (totales, activos, suspendidos) y de establecimientos (conteo y distribución por tipo de negocio), más accesos rápidos a las secciones de administración.

No se crea una carpeta nueva de layout: la pantalla vive dentro del shell existente (`apps/console/src/app/layout/admin-shell.*`) y sigue el patrón ya probado de `apps/console/src/app/features/administration/dashboard/ui/dashboard.ts` (signal store + cliente de API generado directamente, sin importar de otras features).

## 2. Actores

| Rol           | Permiso                                            |
| ------------- | -------------------------------------------------- |
| Super Admin   | Ver dashboard de toda la plataforma                |
| Administrador | Ver dashboard de los establecimientos de su tenant |

## 3. Flujo principal

1. El administrador abre la pantalla de inicio/home de la consola.
2. La vista carga, en paralelo: conteo de tenants (total / activos / suspendidos) y listado de establecimientos.
3. Muestra: tarjetas KPI, distribución de establecimientos por tipo (Restaurante, Discoteca, Salón de eventos, Hotel) y accesos rápidos (Tenants, Configuración, Perfil).
4. Ante error de API, muestra mensaje de error con botón de reintento.

## 4. Decisiones de alcance

- **Solo métricas que el contrato ya soporta:** `tenants.service.listTenants` (paginado, `totalElements`) y `establishments.service.listEstablishments` (array, conteo en cliente).
- **Descartados por falta de endpoint:** "usuarios registrados" (no existe `listUsers`), gráficos de crecimiento/time series, actividad reciente, establecimientos destacados con rating.
- **No WebSocket ni tiempo real** en este CU: los datos se cargan por HTTP al montar.
- **No se toca el sidebar ni el topbar:** se reutiliza el shell existente. Cualquier cambio de navegación es tarea aparte.
- Todo texto visible sale de `STRINGS` en `apps/console/src/app/core/strings.ts` (cero texto hardcodeado).

## 5. Reglas de negocio

- El conteo de establishments se calcula en cliente sobre el array devuelto por `listEstablishments()` (filas vivas ya filtradas por la API; no hay campo de borrado lógico expuesto).
- La distribución por tipo usa `Establishment.type` (`RESTAURANT`, `NIGHTCLUB`, `EVENT_HALL`, `HOTEL`).
- Todo el texto visible es tipado vía `STRINGS`: una errata en una clave no compila.

## 6. Criterios de aceptación

- **[CA-1]** Dado un Super Admin autenticado, cuando abre la pantalla de inicio, entonces ve tarjetas con: total de tenants, tenants activos y tenants suspendidos, provenientes de `listTenants`.
- **[CA-2]** Dado establecimientos registrados, cuando abre el dashboard, entonces ve el conteo total de establecimientos y la distribución por tipo de negocio (Restaurante, Discoteca, Salón de eventos, Hotel).
- **[CA-3]** Dado que la API falla al cargar, entonces se muestra un mensaje de error con un botón de reintento que vuelve a ejecutar ambas cargas.
- **[CA-4]** Todo texto visible de la pantalla proviene de `STRINGS` (sin strings hardcodeados en el componente).
- **[CA-5]** `pnpm check` en verde (lint, typecheck, tests, build).

## 7. Fuera de alcance

- Gráficos de evolución temporal (no hay endpoint time series).
- Métrica de "usuarios registrados" (no existe `listUsers` en el contrato).
- Actividad reciente / notificaciones (no hay endpoint).
- Cambios de estado en tiempo real (WebSocket/STOMP).
- Reestructuración del shell, sidebar o topbar.

## 8. Impacto multi-tenant

- No se crean tablas.
- Las consultas de tenants ya filtran por `tenant_id` en el backend; el cliente no envía `tenant_id` explícito.

## 9. Techo conocido (ponytail)

- `listEstablishments()` devuelve un array sin paginación: el conteo y la distribución se hacen en cliente. Si el listado crece a cientos de establecimientos, hay que pedir un endpoint paginado y mover el agregado al backend. `ponytail: conteo en cliente, paginación si supera cientos de filas.`
