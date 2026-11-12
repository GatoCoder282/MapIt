# Selector obligatorio de establecimiento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** bloquear la entrada operativa sin establecimiento autorizado y restaurar una preferencia válida de localStorage.

**Architecture:** contexto con signals exclusivo de Console en `core/`, consumidor directo del `EstablishmentsService` generado y `AuthSession`. El shell contiene el modal nativo de dos paneles y solo monta su router-outlet cuando existe selección validada. No se cambian selectores internos ni endpoints.

**Tech Stack:** Angular 22, TypeScript 6, RxJS, Vitest, Lucide, HTML dialog, SCSS con tokens MapIt, Playwright.

**Spec:** [spec.md](spec.md); diseño: `apps/console/design/establishment-selector/`.

## Global Constraints

- Backend, contrato y código generado intocables; sin dependencias nuevas.
- localStorage por tenant + usuario; recordar solo ID; restaurar sin modal tras respuesta autorizada nueva.
- Modal obligatorio, sin cierre/omisión ni navegación operativa antes de selección.
- Strings en `core/strings.ts`; tokens globales existentes; excepciones locales documentadas.
- No modificar cambios ajenos presentes en E2E payment-live ni sus specs.
- No hacer commits/push sin petición del usuario.

## Review Focus

- Respuestas tardías tras cambio de usuario, logout o reintento: ignorarlas y no persistir contexto ajeno.
- Storage manipulado/no disponible: jamás aceptar un ID fuera de la lista; fallo de almacenamiento no impide uso en memoria.
- URL profunda sin selección: no inicializar la feature ni alterar el ID explícito del wizard.
- Un establecimiento o cero: no autoelegir el único sin preferencia; no dejar el vacío con Continuar habilitado.
- Sesión restaurada y SUPER_ADMIN: validar staff sin modal si corresponde; plataforma no se ve afectada.

## Patrones de diseño aplicados

| Patrón                               | Por qué aquí                                                               | Alternativa descartada                                                 |
| ------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Signal store de Console              | Estado reactivo compartido por el shell y modal sin imports entre features | Añadir establecimiento a la sesión JWT o duplicar stores por pantalla  |
| Composición presentacional del shell | Modal usa entradas/salidas; contexto resuelve datos y persistencia         | Página de selección con redirecciones/guard, contraria a la referencia |
| API cliente existente                | Mantiene identidad y contrato tipado ya configurados                       | Fetch manual o listado administrativo no filtrado por actor            |

## Task 1 — Contexto validado y persistencia

**Files:** crear `apps/console/src/app/core/establishment-context.ts` y `.spec.ts`.

**Interfaces:** `EstablishmentContext` con signals readonly `establishments: readonly AccessibleEstablishment[]`, `active: AccessibleEstablishment | null`, `status: 'idle' | 'loading' | 'ready' | 'error'`; métodos `load(): Promise<void>`, `confirm(id: string): boolean`. El modal mantiene su candidato hasta confirmarlo. `AuthSession.user()` identifica tenant/usuario; el servicio generated proporciona `listAccessibleEstablishments()`.

- [ ] Escribir tests de carga autorizada, restauración sin modal, ID ausente/manipulado, un único local sin autoelección, lista vacía, error/reintento, storage denegado, cambio de tenant/usuario/logout y respuesta tardía descartada.
- [ ] Ejecutar `pnpm exec ng test console --no-watch --include "**/establishment-context.spec.ts"`; comprobar fallo inicial.
- [ ] Implementar el contexto mínimo, con clave `mapit.establishment.<tenantId>.<userId>`, sin datos de negocio almacenados; validar candidato contra lista actual y estado de sesión. Invalidar generaciones de petición al cambiar identidad, incluso salir y volver a la misma identidad.
- [ ] Repetir tests focalizados; exigir todos verdes.

## Task 2 — Modal y shell

**Files:** crear `apps/console/src/app/layout/establishment-selector.ts`, `.html`, `.scss`, `.spec.ts`; modificar `layout/staff-shell.ts`, `.html`, `.scss` y `core/strings.ts`; añadir `layout/staff-shell.spec.ts` si falta.

**Interfaces:** selector con inputs readonly `establishments`, `status`; outputs `confirmed` (ID), `retry` y `signOut`. Shell pasa signals del contexto, llama `confirm`, `load` y `AuthSession.logout`. El selector solo existe mientras no hay `active`, y abre `<dialog>` con `showModal()` tras render. Candidato se valida también en el modelo, no únicamente deshabilitando botón.

- [ ] Escribir tests que comprueben radios/selección/Continuar, no cierre por cancel ni backdrop, estados carga/error/vacío, título/etiquetas, contenido operativo ausente sin contexto y restauración que monta el outlet sin abrir modal.
- [ ] Ejecutar `pnpm exec ng test console --no-watch --include "**/establishment-selector.spec.ts" --include "**/staff-shell.spec.ts"`; comprobar fallo inicial.
- [ ] Implementar composición aprobada y responsive con `<dialog>` y Lucide. El shell visible no expone datos falsos ni monta operaciones tras un overlay meramente cosmético. No se copia lógica de autorización a la UI.
- [ ] Evitar motion decorativo; cualquier transición añadida requiere evaluación de valor por `find-animation-opportunities` y ejecución con `animate` si corresponde. Respetar reduced-motion.
- [ ] Repetir tests focalizados y validar teclado/foco en navegador real: JSDOM no prueba la modalidad nativa.

## Task 3 — Regresión real y cierre

**Files:** crear test E2E dedicado bajo `apps/e2e/tests/console/establishment-selector.spec.ts`; mocks autorizados explícitos solo para tests. Completar [tasks.md](tasks.md) y criterios de spec según evidencia.

- [ ] Probar con Playwright ausencia de preferencia, confirmación/persistencia, recarga sin modal, selección revocada y lista vacía; usar dos usuarios/tenants para aislamiento y verificar Escape/foco/tabulación. No editar payment-live existente.
- [ ] Capturar escritorio y móvil sin inventar baseline original. Si la imagen original está disponible en disco, ejecutar comparación al umbral 0.02 y reportar el diff numérico; de lo contrario declarar que no se midió fidelidad contra ella.
- [ ] Ejecutar revisiones de accesibilidad, `web-design-guidelines` y preflight visual sin aplicar sugerencias fuera de aprobación. Revisar copy español sin alterar visuales.
- [ ] Reconciliar escritores y ejecutar una vez `pnpm check`; leer qué etapas realmente corrieron. Ejecutar E2E focalizado con servidor disponible. Si falta infraestructura, registrar el bloqueo sin afirmar éxito.
- [ ] Revisar diff y formato solo de archivos propios; confirmar backend y cambios ajenos intactos.

## Task 4 — Reemplazar gestión por selección (ampliación aprobada)

**Files:** `apps/console/src/app/app.routes.ts`, `layout/staff-shell.ts`, `.html`, `.spec.ts`; retirar exclusivamente los archivos sin uso de `features/administration/establishments/` después de comprobar referencias y estado git. No cambiar estilos del popup.

**Interfaces:** conservar `EstablishmentContext.load(): Promise<void>` y `confirm(id): boolean`, así como los inputs/outputs del modal existente. La ruta antigua pasa a redirect `/home?selectEstablishment=1`; el shell observa query params con APIs Angular/RxJS ya presentes. Un marcador de apertura explícita muestra el selector aunque haya contexto activo. Al solicitarlo, refresca lista autorizada sin duplicar cargas en vuelo; al confirmar con éxito, navega a `/home`. El flujo obligatorio inicial sigue cerrándose sin redirección de URLs profundas.

- [ ] Escribir y ejecutar tests rojos: ruta vieja ya no carga CRUD; apertura explícita con selección activa; confirmación válida actualiza preferencia y navega a Inicio; rechazo de ID inválido no navega; entrada normal no fuerza otro popup.
- [ ] Implementar la redirección y apertura explícita en shell, manteniendo los enlaces `/establishments` como accesos al popup. No añadir componente, librería ni abstracción nuevos.
- [ ] Comprobar todos los imports/callers y git status antes de retirar archivos CRUD exclusivamente huérfanos; no borrar modificaciones ajenas ni código de otras features. Si algún archivo tiene cambios ajenos, retirar solo la ruta y documentar por qué se conserva ese archivo.
- [ ] Ejecutar tests focalizados de shell/contexto/modal y ESLint de archivos modificados con cero warnings.

## Task 5 — Regresión del acceso manual

**Files:** extender `apps/e2e/tests/console/establishment-selector.spec.ts`, sin editar los E2E payment-live ajenos.

- [ ] Añadir casos con preferencia autorizada: visita directa `/establishments` y clic Negocios muestran popup y no CRUD; elegir segundo establecimiento y continuar termina en `/home`, persiste el nuevo ID y recarga sin modal.
- [ ] Añadir rechazo/errores del listado durante la apertura explícita sin permitir saltarse selección.
- [ ] Ejecutar E2E focalizado en console/console-tablet contra servidor existente; esperar respuesta accesible al navegar/refrescar en lugar de sleeps.
- [ ] Revisar accesibilidad y Web Interface Guidelines sobre el diff; el diseño visual se reutiliza sin cambios.
- [ ] Reconciliar escritores, ejecutar `pnpm check` una vez y comprobaciones focalizadas adicionales solo si hay fallos nuevos. Registrar evidencia en `tasks.md` sin commits/push.

## Task 6 — Ajuste visual de referencia y X opcional (aprobado)

**Files:** diseñador: `layout/establishment-selector.{html,scss}` y ajustes de iconos/foco en `.ts`; fixer: API `canDismiss = input(false)`, `dismissed = output<void>()` y handler de cancel en ese `.ts`, `layout/staff-shell.{ts,html}`, tests selector/shell y E2E existente `apps/e2e/tests/console/establishment-selector.spec.ts`. Orquestador: strings y documentación. No compartir escritura del `.ts`: fixer primero implementa API; diseñador espera esa parte o propone imports/foco para reconciliar después.

**Interfaces:** el shell captura temporalmente solo el ID previo al abrir el cambio (el refresh borra `active`); calcula `canDismiss` con status ready y pertenencia a la lista recién validada. En URL directa con preferencia restaurada, puede derivar el ID previo de `active`. El evento `dismissed` restaura mediante `context.confirm(id)` validado y navega a `/home`; nunca usa el candidato local. Sin previo autorizado, falla cerrado.

- [ ] Escribir tests rojos: X ausente inicial/carga/error/revocado, X presente en reapertura válida, marcar B y cerrar conserva A, cerrar elimina marcador, Escape solo cierra en reapertura válida.
- [ ] Implementar API y conexión de shell mínimas, sin modificar persistencia ni `EstablishmentContext`; repetir tests focalizados.
- [ ] Ajustar visual local según segunda imagen: proporciones compactas, panel azul más intenso, menos vacío vertical, títulos/tarjetas/CTA legibles; conservar miniaturas neutras y estados vacíos/carga/error. No quitar focus-visible de controles de teclado para ocultar un outline programático.
- [ ] Ejecutar E2E selector escritorio/tablet y capturas 390 px, revisar visual/a11y; orquestador reconcilia y ejecuta una vez `pnpm check`. Registrar resultados y límites sin commits/push.
