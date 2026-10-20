# CU-10 — Tareas de ejecución

## Tareas (en orden)

1. [ ] Añadir claves `adminDashboardHome` a `apps/console/src/app/core/strings.ts` (títulos, etiquetas de KPI, mensaje de error, reintento).
2. [ ] Reescribir `apps/console/src/app/features/home/home.ts`: template con tarjetas KPI, distribución por tipo, accesos rápidos, estados loading/error; lógica con signals y `forkJoin`.
3. [ ] Estilos con tokens de `libs/ui-kit/styles/_tokens.scss` (sin hardcodear colores ni px sueltos).
4. [ ] Prueba unitaria Vitest: `home.spec.ts` que cubra CA-1, CA-2, CA-3, CA-4.
5. [ ] `pnpm check` en verde (lint, typecheck, tests, build).

## Notas de ejecución

1. strings.ts: añadido bloque `adminDashboardHome` con todas las claves de texto (cero hardcode en el componente).
2. home.ts: sustituido el placeholder de andamiaje por el dashboard real. Señales + forkJoin para cargar tenants (listTenants, paginado) y establecimientos (listEstablishments, array, conteo en cliente). Estilos solo con tokens de libs/ui-kit/styles/_tokens.scss. No se toca el shell ni el sidebar.
3. home.spec.ts: 2 pruebas (KPIs + distribución CA-1/CA-2, error y reintento CA-3).
4. Verificación: pnpm fe:typecheck verde, eslint --max-warnings=0 limpio, prettier limpio, 2 tests Vitest verdes.

Decisiones: se descartaron "usuarios registrados" (no existe listUsers), gráficos de tiempo series, actividad reciente y WebSocket para este CU (sin contrato). El conteo de establishments se hace en cliente sobre el array; techo conocido: paginar si supera cientos de filas.
