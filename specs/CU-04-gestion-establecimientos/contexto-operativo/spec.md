# CU-04 — Contexto operativo único en Console

Estado: aprobada por el usuario; implementación y validación agregada completadas. Evidencia y límites en [tasks.md](tasks.md). Complementa [selección global](../seleccion-establecimiento/spec.md); no sustituye ni rediseña su popup.

## Problema y objetivo

El popup ya valida y persiste un establecimiento mediante `EstablishmentContext`, pero Mapa/Estructura, Nueva reserva, Check-in y Métodos de pago mantienen selecciones locales. El usuario debe elegir una sola vez y operar en ese ámbito hasta cambiarlo globalmente.

## Alcance

- `/spaces/setup`: entrar directamente en la estructura del establecimiento activo, omitiendo únicamente el paso de elección. Conservar creación/edición genuina de establecimientos y gestión de plantas, sectores y elementos.
- `/reservations/new`: cargar espacios reservables del activo sin desplegable local; enviar su ID en el endpoint existente.
- `/check-in`: preparar recepción, búsqueda y escáner con el activo validado; limpiar comprobantes y cámara al abandonar o invalidar el contexto.
- `/administration/settings/payment-methods`: cargar y gestionar únicamente configuraciones del activo; iniciar el borrador de nueva configuración asociado a él si no tiene ninguna. Una configuración ajena nunca puede usarse para editar o guardar.
- Revisar URLs profundas de estructura y editor para impedir que un identificador antiguo imponga otro establecimiento al contexto.

## Fuente única de verdad

Flujo: popup global → `EstablishmentContext` → módulos. API real: signals `active`, `status`, `establishments`; métodos `load()` y `confirm(id)`. Los módulos consumen el activo; no confirman selecciones ni mantienen listas o preferencias paralelas para elegir contexto.

La persistencia existente conserva solo el ID por tenant y usuario y lo revalida frente al listado accesible. No se añade storage, servicio global ni dependencia. El shell ya espera la resolución y no monta el contenido operativo sin selección válida.

Tipos existentes: `active` es `Signal<AccessibleEstablishment | null>`, `establishments` es `Signal<readonly AccessibleEstablishment[]>` y `status` es `Signal<'idle' | 'loading' | 'ready' | 'error'>`. `load(): Promise<void>` revalida la lista y `confirm(id: string): boolean` confirma/persiste solo un ID accesible con estado `ready`. Las features leen signals mediante `computed`/`effect`, no los tratan como Observables.

## Alternativas y decisión

1. **Consumo reactivo del contexto existente (propuesta):** derivar el ID y ámbito autorizado, reiniciar datos dependientes e invalidar trabajo anterior. Mantiene una sola selección.
2. Sincronizar selectores locales llamando a `confirm()`: descartado; reproduce los cuatro mecanismos que se pretende eliminar.
3. Reescribir módulos o crear otro servicio/guard de selección: descartado; duplica responsabilidades del shell y aumenta el alcance sin necesidad.

El usuario aprobó la protección de salida **confirmar y bloquear**: pedir confirmación para descartar cambios y bloquear navegación durante escrituras. Se implementará fuera del popup, mediante mecanismos de ruta/formulario, reutilizando las protecciones existentes cuando las haya.

Decisiones técnicas propuestas por el implementador: usar `CanDeactivate` en las rutas afectadas (no existe hoy una guarda de salida común); comprobar primero escritura en curso, después borrador modificado. Para el descarte basta confirmación nativa accesible, sin nuevo componente modal. El estado dirty se compara con el borrador inicial/último guardado, no con el mero hecho de haber cargado datos. El plan concretará el estado de formularios inline y editores.

## Inicialización, carga y errores

- `idle`/`loading` no equivalen a ausencia definitiva: no ejecutar consultas o escrituras operativas hasta tener activo válido.
- Sin activo, reutilizar el bloqueo/selector global del shell; no crear fallback local ni elegir automáticamente otro establecimiento.
- Restauración tras recarga y entrada directa siguen el mismo flujo global.
- Mantener errores y reintentos de datos de cada módulo, sin recargar el listado global en cada pantalla ni duplicar solicitudes.
- Respetar permisos/capacidades del activo; una opción accesible no garantiza permiso para pagos o check-in.

## Cambio de establecimiento y concurrencia

- El acceso global actual navega a `/home?selectEstablishment=1`, desmonta el contenido operativo y finalmente confirma en Inicio. Las guardas deben ejecutarse antes de perder el formulario.
- Con borrador modificado, confirmar descarte antes de abandonar; rechazar conserva pantalla, datos y contexto. Con escritura en curso, impedir salida hasta resolverla, sin afirmar que cancelar HTTP revierte una transacción.
- Al cambiar/invalidation del activo, limpiar datos, selecciones de elementos, formularios temporales, comprobantes, errores y éxitos anteriores; cancelar consultas/suscripciones y liberar escáner cuando corresponda.
- Además de cancelar, impedir que callbacks tardíos actualicen el nuevo ámbito, incluso en secuencia A → B → A. Los payloads y recursos seleccionados deben corresponder al ámbito cargado vigente, no solo a un ID leído al enviar.
- Los stores con vida mayor que el componente deben limpiar su estado y operaciones al salir. Si existen WebSockets dependientes del ámbito, desuscribir el anterior antes de suscribir el nuevo.
- No adoptar un ID de URL como selección global: validar pertenencia del recurso y rechazar o redirigir al inicio de estructura del activo ante discrepancia.

La pertenencia se comprueba con datos de las APIs existentes: un `establishmentId` de ruta debe coincidir con el activo; una planta debe estar en las plantas cargadas del activo y un sector en los sectores de una planta validada. No basta comparar IDs de tipos distintos ni invocar RLS desde Angular. Reutilizar contadores de generación/epoch presentes; donde falten, invalidarlos al cambiar ámbito o destruir componente. La cancelación real de observables se hace por desuscripción/cleanup, no añadiendo `take(1)` a HTTP como supuesto sustituto.

## Seguridad y límites

El tenant sigue procediendo exclusivamente del JWT. El establecimiento es un ámbito operativo, no una autorización. Conservar backend, permisos, RLS y reglas de negocio, incluido rechazo de comprobantes de otro establecimiento. Mantener IDs requeridos por los endpoints existentes.

Para pagos se conserva rol ADMIN y capacidad `active().canManagePayments`; para recepción, roles ADMIN/STAFF y `active().canCheckIn`, además de flags/validaciones existentes. Reservas y estructura mantienen sus controles actuales y errores 403, sin inventar capacidades que el contrato no proporciona. Estas comprobaciones solo mejoran UX; nunca sustituyen la autorización del endpoint.

`/admin/*` y su shell de SUPER_ADMIN no requieren establecimiento y quedan fuera del cambio. No se rediseñan popup, dashboard ni tokens. Sin cambios de backend/contrato/migraciones salvo limitación demostrada y documentada antes de ampliar alcance.

## Criterios de aceptación

- [x] Dado un activo validado, cuando entra en cualquiera de los cuatro módulos, entonces carga su información sin selector local ni otra consulta de opciones para elegir establecimiento.
- [x] Dada una preferencia válida, cuando recarga o entra por ruta directa, entonces espera la restauración y opera en el mismo establecimiento sin otra selección.
- [x] Dado contexto cargando, inválido o con error, cuando intenta operar, entonces no se emiten operaciones sin ámbito válido y se reutiliza la resolución global.
- [x] Dado Mapa/Estructura, cuando abre `/spaces/setup`, entonces accede a plantas/sectores del activo y conserva acceso a formularios de gestión genuina.
- [x] Dado un ID antiguo de planta, sector o establecimiento en URL, cuando no pertenece al activo, entonces no se opera sobre él ni cambia el contexto global.
- [x] Dada Nueva reserva, cuando guarda, entonces el payload y sus elementos pertenecen al ámbito activo cargado; conserva validaciones de cliente, fechas y disponibilidad.
- [x] Dado Check-in, cuando inicia cámara o consulta y registra llegada, entonces utiliza el activo permitido; un cambio limpia comprobante y recursos del escáner y el backend sigue rechazando comprobantes ajenos.
- [x] Dado Métodos de pago, cuando carga, crea, edita o activa configuración, entonces todas las operaciones se limitan al activo; una configuración ajena no se reutiliza y se preservan sus validaciones.
- [x] Dado un borrador modificado, cuando solicita abandonar/cambiar establecimiento, entonces confirma descarte; cancelar conserva formulario y contexto.
- [x] Dada una escritura pendiente, cuando solicita abandonar/cambiar establecimiento, entonces la salida se bloquea hasta resolver, sin duplicar el envío.
- [x] Dado cambio o invalidación del contexto, cuando llegan respuestas del anterior, entonces no sobrescriben datos ni muestran éxito/error en el nuevo; se cancelan suscripciones dependientes.
- [x] Dado un usuario sin capacidad para una operación, cuando entra o intenta ejecutarla, entonces no se habilita y backend mantiene su autorización.
- [x] Dado SUPER_ADMIN, cuando navega por `/admin/*`, entonces no se exige selección de establecimiento.
- [ ] Dadas las cuatro pantallas, cuando se usan con teclado y viewport estrecho, entonces mantienen diseño, formularios, estados accesibles y responsive sin controles redundantes.

## Verificación prevista

Tests focalizados de stores/componentes con contexto simulado y respuestas controladas: carga inicial, activo ausente, cambio, respuesta tardía, limpieza, payload correcto, permisos y configuración ajena. Tests de guardas para borrador y escritura. Regresión del contexto/shell y ruta de plataforma. E2E de navegación y recarga con selección global, si el stack está disponible. Ejecutar lint, tipos, tests/build reales y registrar únicamente resultados ejecutados en `tasks.md`.

## Datos y esquema

Sin tablas, migraciones ni cambios de tenant/RLS. Sin nueva persistencia local. La API continúa siendo responsable de pertenencia y autorización.
