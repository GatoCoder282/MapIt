# Especificación — QR MOCK persistido en checkout público

Estado: decisión técnica del padre incorporada dentro del alcance autorizado por la petición del usuario; pendiente validación documental final del padre y no implementada. No se afirma aprobación adicional del usuario. Esta subhistoria conecta el QR MOCK persistido con checkout y supersede la exclusión histórica de [qr-persistido](../qr-persistido/spec.md) solo para este alcance.

## 1. Historia

Como cliente con acceso válido a una reserva, quiero usar en checkout el proveedor MOCK asociado a la configuración QR de mi establecimiento y simular **ese intento** desde su QR, para probar el recorrido sin dinero real.

## 2. Decisión de enlace y límites

- `MockQrConfiguration` es la autoridad de los datos de cuenta (país, banco, titular y referencia) y de la habilitación de su proyección. `PaymentPolicy` es la autoridad de moneda y de importes/cotización; no se crean ni cambian política o quote por sincronizar.
- Cada configuración puede tener una proyección local `MOCK_GATEWAY` en `merchant_payment_method`, identificada por `mock_qr_configuration_id` con FK compuesta tenant/establecimiento. La proyección actual es la vinculada cuyo `superseded_at` es `NULL`; una restricción de unicidad impide más de una actual por configuración.
- La proyección se sincroniza al guardar configuración o política, en una transacción bajo el mismo lock del establecimiento. Sin una política existente no se materializa una proyección. La habilitación de política no se infiere ni se cambia: aunque exista una política deshabilitada, checkout conserva `PAYMENT_POLICY_DISABLED`.
- La selección tradicional excluye proyecciones antes de decidir entre métodos locales y fallback tenant-global, para que una proyección MOCK no oculte fallback de otros proveedores. Checkout público ofrece MOCK únicamente mediante proyección local actual habilitada; métodos tenant-global MOCK y métodos MOCK locales no proyectados no son elegibles.
- CRUD genérico de métodos no permite editar proyecciones. Sin pagos y sin cambios incompatibles se actualiza la proyección actual. Si ya tiene pagos y cambia moneda o datos de cuenta, se marca la proyección anterior con `superseded_at` y se crea una nueva; pagos y métodos históricos se conservan sin reescribir sus importes ni referencias.
- En `PublicCheckout`, `methods` representa opciones iniciables; `historicalMethod` es requerido nullable (`PublicPaymentMethod | null`) e identifica el método del intento recuperado sin convertirlo en opción de nuevo cobro.
- La migración aditiva incorpora la relación y hace backfill determinista a partir de configuración QR y política existentes; no enlaza métodos por coincidencia textual. Los métodos tradicionales y tenant-global quedan sin FK.
- `simulationToken` no es una credencial financiera. El QR del checkout identifica el `paymentId` concreto y transporta capability de reserva; nunca habilita un cobro nuevo por sí solo.

## 3. Criterios de aceptación

1. **Proyección única.** Dada una reserva `CREATED`, una política existente y habilitada y una configuración QR local habilitada, cuando se consulta checkout, entonces aparece solo la proyección actual FK-vinculada de esa configuración, con la moneda de política y la ruta de simulación; el GET no crea ni cambia política, quote ni pago.
2. **Sin materialización sin política.** Dada una configuración habilitada y ninguna política para el establecimiento, cuando se guarda/sincroniza configuración o se consulta checkout, entonces no existe proyección actual elegible y se conserva `PAYMENT_POLICY_DISABLED` sin inventar moneda o importe.
3. **Selección tradicional y fallback.** Dado que existen proyecciones MOCK junto con métodos tradicionales tenant-global, cuando se lista/consulta selección tradicional, entonces las proyecciones no alteran la detección de métodos locales ni ocultan el fallback de otros proveedores; checkout QR MOCK nunca ofrece un método global ni un MOCK no proyectado.
4. **Autoridad de configuración y política.** Dado un guardado de configuración o política, cuando se sincroniza la proyección, entonces sus datos/habilitación provienen de `MockQrConfiguration` y su moneda de `PaymentPolicy`; la sincronización no autoactiva ni modifica política, quote, importes o ventana de cobro.
5. **Historial de proyección.** Dado que una proyección no tiene pagos, cuando cambian datos de cuenta/moneda, entonces puede actualizarse en sitio. Dado que tiene pagos y cambian datos sensibles, cuando se guarda, entonces la anterior queda `superseded_at` y se crea una nueva, conservando intactos pagos, referencias y método histórico.
6. **CRUD protegido.** Dada una proyección MOCK vinculada, cuando se intenta editarla mediante CRUD genérico de métodos, entonces la operación se rechaza; solo el flujo de sincronización autorizado por configuración/política la modifica.
7. **Sin fallback MOCK global.** Dado un método MOCK tenant-global y ninguna proyección local actual, cuando se consulta o inicia checkout público, entonces se rechaza como `PAYMENT_METHOD_UNAVAILABLE`; el fallback global de otros proveedores permanece sin cambios.
8. **Intento pendiente.** Dado un intento MOCK vigente del método local proyectado actual, cuando se inicia de nuevo con el mismo u otro `requestId`, entonces se devuelve/reutiliza ese intento bajo el lock de reserva y no se crea otra sesión. Dado un intento vigente de una proyección superseded, cuando se recarga checkout, entonces `payment` conserva su estado y `historicalMethod` identifica el método anterior, mientras `methods` no lo ofrece como opción iniciable; no se crea otro cobro hasta estado terminal y el QR original puede resolver solo ese intento. Sin método histórico recuperable, `historicalMethod` es `null`.
9. **Simulación por intento.** Dado un QR de un pago MOCK `PENDING`, cuando se abre, entonces identifica `paymentId` y capability de reserva y presenta acciones explícitas confirmar, cancelar/expirar y fallo; abrir o escanear no envía evento. La acción afecta únicamente ese intento y usa los outcomes permitidos del simulador.
10. **Seguridad/runtime.** Dada una ejecución real de simulación, cuando se procesa el intento, entonces requiere capability válida, opt-in MOCK y perfil `dev`/`test`, usa el webhook HMAC y conserva la actualización realtime existente; no se exponen datos de cuenta ni secretos en respuesta/QR.
11. **Recibo, recarga y check-in separados.** Dado un pago confirmado, cuando se recarga checkout o recibo, entonces se recupera el estado persistido y el recibo existente sigue siendo verificable. La confirmación del pago no marca llegada ni activa check-in; el ciclo de llegada permanece separado.
12. **Concurrencia e aislamiento tenant.** Dadas dos solicitudes simultáneas con `requestId` distintos para la misma reserva/método, cuando intentan iniciar MOCK, entonces una sola proyección vigente/sesión/pago se reutiliza. Dada una FK con tenant o establecimiento distinto, cuando se intenta persistir, entonces la base rechaza el vínculo y RLS/queries mantienen el aislamiento.

## 4. Fuera de alcance

Bancos reales, autoactivación de políticas/métodos, importes por defecto, cambios a `paymentPreviewEnabled`, implementación del check-in (solo se valida que no se dispare con el pago), y escritura en Jira. Recibo verificable y su ciclo de lectura sí forman parte de la validación de integración; las fixtures de preview no sustituyen el backend.

## 5. Dependencias y evidencia local

- Se reutilizan el método/política y el simulador del checkout existentes; el QR administrativo actual no está conectado hoy. El mapa de funciones y pruebas está en [plan](plan.md).
- `PublicCheckoutService.unavailableReason` ya devuelve `PAYMENT_POLICY_DISABLED` para política ausente/deshabilitada; esa razón no se cambia.
- El descubrimiento Jira es solo el documento local [jira-discovery.md](../jira-discovery.md), no una consulta remota de esta tarea. MAP-229 y MAP-228 figuran “En curso”, MAP-193 “Listo” y el documento registra MAP-229 bloqueada por MAP-228. No se afirma que esos estados sigan vigentes.

## 9. Aislamiento multi-tenant

La FK de la proyección debe comprobar conjuntamente `tenant_id`, `establishment_id` y `mock_qr_configuration_id` contra la misma configuración. La fila proyectada debe ser local y `MOCK_GATEWAY`; los métodos tradicionales/globales mantienen FK nula. La migración conservará `tenant_id NOT NULL`, índices tenant compuestos, RLS ya habilitado en `merchant_payment_method` y las consultas con filtro explícito por tenant. El backfill y pruebas deben ejecutarse exclusivamente en bases aisladas de migración/Testcontainers, nunca contra una base compartida.
