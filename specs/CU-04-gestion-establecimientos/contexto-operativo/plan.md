# Contexto operativo único — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** usar exclusivamente el establecimiento global en estructura, reservas, recepción y pagos.

**Architecture:** los stores consumen signals del `EstablishmentContext` existente; el shell conserva selección, validación inicial y persistencia. Datos dependientes se reinician por generación de contexto y se cancelan consultas/suscripciones. Guardas de salida protegen borradores y escrituras sin modificar el popup.

**Tech Stack:** Angular 22, signals, RxJS, TypeScript 6, Vitest, Playwright existentes.

**Spec:** [spec.md](spec.md).

## Global Constraints

- Sin nuevo selector, servicio global de contexto, persistencia, dependencia, backend, contrato ni migración.
- Features leen `active()`/`status()`; nunca llaman `confirm()` ni toman selección de URL.
- Preservar permisos y validaciones; `/admin/*` independiente.
- Conservar trabajo previo del workspace; sin commits/push ni restauraciones masivas.
- UI a cargo de diseñador, lógica de stores en carriles separados. Strings nuevos solo en `core/strings.ts`, a cargo del orquestador.

## Review Focus

- A → B → A con respuesta de primera A: descartar por generación, no solo por igualdad de ID.
- Cambio inmediato antes de ejecutar effect: submit exige que datos cargados correspondan al activo actual.
- Configuración QR ajena recibida o pasada a un método: rechazar edición, toggle y regeneración fuera del activo.
- Navegación al selector con escritura pendiente: `CanDeactivate` bloquea antes de desmontar el outlet.
- URL de planta/sector antiguo con selección restaurada: no cargar/modificar recursos fuera del activo.

## Patrones de diseño aplicados

| Patrón                            | Por qué aquí                                                        | Alternativa descartada                                       |
| --------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| Signal store existente            | Contexto único reactivo y derivación local, sin nuevas preferencias | Sincronizar cuatro selecciones                               |
| Generación + cleanup              | Invalida respuestas y libera recursos por ámbito/vida de componente | Comparar solo ID o añadir `take(1)` a HTTP                   |
| Guarda `CanDeactivate` funcional  | Protege navegación y cambio global antes de desmontar               | Modificar popup o cancelar escrituras como supuesto rollback |
| API cliente y permisos existentes | Conserva JWT, autorización y contratos                              | Fetch manual, flags/permisos inventados                      |

## Tarea 1 — Contrato de salida y rutas (orquestador)

**Archivos:** crear `apps/console/src/app/core/operational-exit-guard.ts` y `.spec.ts`; modificar `app.routes.ts`, `core/strings.ts`.

**Interfaces:** exportar `OperationalPage { canDeactivate(): boolean }`, `operationalExitGuard: CanDeactivateFn<OperationalPage>` y `confirmOperationalExit(busy: boolean, dirty: boolean): boolean`. Retornar false con busy; de otro modo true si no dirty o confirmación nativa aceptada. Copy en `STRINGS.establishmentContext`.

- [ ] Escribir test de limpio, dirty/confirmar, dirty/cancelar, busy sin preguntar y delegación de guarda; ejecutar rojo.
- [ ] Implementar helper/guarda mínimos y repetir verde.
- [ ] Registrar `canDeactivate` en páginas operativas con `canDeactivate()` implementado por Tarea 5; nunca en `/admin/*`.

## Tarea 2 — Reservas y recepción (fixer)

**Archivos:** `features/reservations/model/reservation-form-store.ts`, `.spec.ts`; `features/reservations/data/reservations-api.ts`, `.spec.ts` solo si queda API local huérfana; `features/check-in/model/check-in-store.ts`, `.spec.ts`; `features/check-in/data/check-in-api.ts`, `.spec.ts` solo si hace falta retirar listado local o aislar demo.

**Interfaces:** ambos stores exponen `readonly busy: Signal<boolean>` y `readonly dirty: Signal<boolean>` para salida; mantener operaciones existentes salvo selección/listado local. `establishmentId` y nombre derivan del activo. Reservas conserva `load()` como reintento de elementos si UI lo necesita, sin listado de establecimientos. Check-in conserva `arrive/query/scan`, invalida watch al cambiar ámbito y verifica `canCheckIn`.

- [ ] Tests rojos: activo inicial/cargando/ausente, cambio A/B y A/B/A, respuesta tardía, invalidación inmediata antes de effect, payload correcto, no duplicar submit, permisos y cleanup del watch.
- [ ] Derivar ámbito sin signal de selección independiente; resetear formulario/resultado por cambio y añadir cleanup en destroy. Mantener timezone/validaciones. No inventar imports `@mapit/core`.
- [ ] Bloquear escrituras si contexto/datos ya no corresponden; `busy` cuenta escrituras reales, no consultas. `dirty` compara formulario/resultado temporal con estado limpio.
- [ ] Ejecutar solo tests de stores/APIs de este ámbito y ESLint de sus archivos; reportar evidencia y cambios de interfaces a diseñador.

## Tarea 3 — Pagos (fixer)

**Archivos:** `features/payments/model/payment-methods-store.ts`, `.spec.ts`.

**Interfaces:** `readonly busy` agrega save/toggle/regenerate/savePolicy; `readonly dirty` compara QR y policy con baseline; sin `setEstablishment` ni opciones de establecimiento. `draft().establishmentId` puede permanecer como payload temporal, pero siempre se deriva/revalida contra activo cargado y se limpia al cambiar. Mantener métodos públicos de gestión de configuración y países.

- [ ] Tests rojos: filtrar configuraciones por activo, crear vacío para activo sin configuración, rechazar configuración ajena en todos los métodos, permisos, cargas/respuestas tardías y cambios antes del effect.
- [ ] Quitar llamada duplicada a listado accesible; exigir ADMIN y `active.canManagePayments`. Usar epoch existente y destroy cleanup para todos los awaits, incluido QR y readiness.
- [ ] Capturar ámbito antes de await y comprobar generación tras cada await; impedir que finally/éxito anterior contamine nueva operación. Conservar validaciones monetarias y QR.
- [ ] Probar dirty/busy, payload y bloqueo de doble envío; ejecutar test del store y ESLint focalizados.

## Tarea 4 — Estructura y editores (fixer)

**Archivos:** `features/spaces/model/spaces-store.ts` y nuevo `.spec.ts`; `features/map-editor/model/{map-editor-store,floor-editor-store}.ts` y sus `.spec.ts`; `features/spaces/data/spaces-api.ts`, `features/map-editor/data/map-editor-api.ts` solo si las APIs existentes necesitan composición para pertenencia.

**Interfaces:** stores exponen `readonly busy` para escrituras y, cuando ya haya edición pendiente, `readonly dirty`. `SpacesStore` conserva acciones de creación/edición genuina; la selección operativa se deriva del contexto, nunca de `selectEstablishment(id)` arbitrario. Coordinar con diseñador cómo retirar callers locales y validar recursos de ruta.

- [ ] Tests rojos: cargar plantas del activo, cambio/reset de stores root, URL/recurso ajeno no habilita operaciones, respuestas tardías y escrituras bloqueadas con ámbito inválido.
- [ ] Derivar establecimiento del contexto, usar API/listas existentes para verificar floor/sector antes de cargar datos editables; limpiar suscripciones/recursos por cambio y destroy. No usar `take(1)` como cancelación de contexto.
- [ ] Revalidar ámbito al escribir y proteger callbacks de cargas/guardados; no reescribir el motor ni cambiar API pública sin coordinar UI.
- [ ] Ejecutar tests de spaces/map-editor stores y ESLint focalizados.

## Tarea 5 — UI integrada sin selectores (designer)

**Archivos:** `features/reservations/ui/reservation-form.{ts,html,scss}`; `features/check-in/ui/check-in.{ts,html,scss,spec.ts}`; `features/payments/ui/payment-methods.{ts,html,scss,spec.ts}`; `features/spaces/ui/{wizard-establishment,spaces,sector-page,wizard-summary}.ts`; `features/map-editor/ui/{map-editor-page,floor-editor-page}.ts`. Specs nuevas de páginas cuando sea necesario.

**Interfaces:** consumir stores Tareas 2–4; cada página con guarda exporta `canDeactivate(): boolean` usando `confirmOperationalExit(store.busy(), dirtyActual)`. Usar estado de formulario real en páginas inline. Sin modificar popup/shell ni `strings.ts`; proponer copy al orquestador si hace falta.

- [ ] Quitar selectores locales y sus estados vacíos exclusivos; conservar formularios CRUD genuinos, país, cámara, gestión de configuraciones y errores/carga.
- [ ] `/spaces/setup` lleva a estructura del activo sin elección; mantener formularios genuinos disponibles sin volverlos selección operativa. Alinear resumen/URLs de plantas/sectores con contexto.
- [ ] Scanner solo con activo/capacidad válida, detener cámara en invalidación/destrucción; testear que desaparece selección local, no el selector de cámara.
- [ ] Implementar guardas de salida en componentes y sus tests; conservar layout y responsive. No rediseñar páginas ni popup.
- [ ] Ejecutar tests UI del ámbito y comprobación a11y sobre controles alterados; no ejecutar suite completa.

## Tarea 6 — Integración y verificación (orquestador)

**Archivos:** nuevo `apps/e2e/tests/console/operational-establishment.spec.ts` y fixture existente solo si es imprescindible; actualizar `apps/console/AGENTS.md` en su nota del wizard para no dejar instrucciones contradictorias; documentación de esta carpeta.

- [ ] Leer diffs y reconciliar contratos de stores/componentes/guardas. Revisar ausencia de selector/listado local y preservación de `/admin/*` y backend/contrato.
- [ ] Verificar tests de contexto/shell y guardas, y regresión de rutas. Añadir E2E de selección/restauración, cuatro pantallas, cambio, rechazo de descarte y bloqueo durante escritura; mocks controlados no se presentan como prueba de backend.
- [ ] Reutilizar servidores existentes. Ejecutar E2E focalizado si disponible; si no, registrar prerrequisito/bloqueo. Revisar flujo visual accesible sin cambiar identidad.
- [ ] Ejecutar una vez `pnpm check` tras reconciliar escritores; `pnpm api:lint` si cambia contrato (no previsto). Corregir y repetir únicamente etapas afectadas.
- [ ] Registrar resultados realmente ejecutados y limitaciones en `tasks.md`; marcar aceptación según evidencia, sin afirmar autorización backend con mocks frontend.

## Evidencia y presupuesto

Cada escritor es dueño de tests focalizados de su lógica/UI. Orquestador es dueño de suite agregada y flujo E2E. Tests con signals controladas y Subject/promesas diferidas hacen observables las carreras; E2E comprueba integración de rutas y DOM, no sustituye la autorización del servidor. Backend no se modifica: inspección de validaciones existentes y resultado de regresión disponible, sin ampliar integración injustificadamente.
