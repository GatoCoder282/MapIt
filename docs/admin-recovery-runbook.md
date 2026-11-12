# Recuperación excepcional del último ADMIN — HU-1.04 / CA-05

## Estado y punto de parada

El núcleo interno y el consumo del token del titular están implementados. `RecoveryApprovalSource` lee el registro V37 escrito por una cuenta PostgreSQL personal del responsable designado, con permisos distintos de `mapit_app`. **CA-05 PASS para el procedimiento manual aprobado:** la integración aislada PG17 verificó la fuente real con una cuenta de aprobador ficticia y el adaptador SMTP entregó un mensaje ficticio a Mailpit local. `POST /api/v1/platform/admin-recoveries` continúa **deshabilitado por defecto**. El registro prueba qué cuenta de BD aprobó; antes de un caso real, infraestructura debe comprobar que pertenece a otra persona y concederle acceso temporal. El ensayo no envió mensajes a personas reales ni modificó la base de desarrollo.

## Preparación de acceso del responsable

Infraestructura crea una cuenta PostgreSQL personal para el responsable designado, con autenticación propia y sin pertenencia al SUPER_ADMIN ejecutor. El rol `mapit_recovery_approver` existe por V37 como `NOLOGIN`; el administrador de BD concede su pertenencia solo a esa cuenta tras comprobar su identidad y registrar la asignación en el ticket. Configura la contraseña de forma interactiva (`\password` en `psql`), nunca en SQL versionado, argv, ticket ni logs. Revoca la pertenencia cuando termina la ventana operativa. `mapit_app` solo puede leer V37; no puede insertar, modificar ni revocar evidencias. La cuenta personal solo puede leer, insertar el alcance permitido y revocar una evidencia; `session_user` fija el autor y la fecha la fija PostgreSQL. El responsable no debe compartir su credencial con el SUPER_ADMIN.

Con la cuenta administradora de BD, la concesión comprobada es `GRANT mapit_recovery_approver TO "<cuenta_personal>";` y su retiro al terminar es `REVOKE mapit_recovery_approver FROM "<cuenta_personal>";`. El marcador debe sustituirse por el identificador exacto de la cuenta personal ya autenticada; nunca usar `mapit_app`, el owner de migraciones ni una cuenta compartida.

Antes de aplicar V37 sobre un entorno que ya tenga V35, infraestructura comprueba con la cuenta de migración si hay referencias documentales repetidas: `SELECT approval_reference, count(*) FROM admin_recovery_authorization WHERE approval_reference IS NOT NULL GROUP BY approval_reference HAVING count(*) > 1;`. Si devuelve filas, detener la migración y resolver el historial con un plan preservador de datos; no editar V33–V36 ni usar `repair`. La base de desarrollo con historial Flyway divergente no se usa para este ensayo.

La cuenta personal se conecta con `psql -h <host> -p <puerto> -U <cuenta-personal> -d mapit -W`. Antes de registrar una aprobación, coteja el ticket original y ejecuta la siguiente plantilla en su sesión; `\prompt` evita poner datos variables en la línea de comandos. El `reference` incluye el ticket y un identificador único, por ejemplo `MAP-238#<UUID>`.

```sql
\set ON_ERROR_STOP on
\prompt 'Referencia ticket#UUID: ' reference
\prompt 'Tenant ID: ' tenant_id
\prompt 'Tenant slug: ' tenant_slug
\prompt 'UUID del ADMIN inactivo: ' target_id
\prompt 'Ticket: ' ticket
\prompt 'Motivo: ' reason
\prompt 'Inicio UTC ISO-8601: ' valid_from
\prompt 'Fin UTC ISO-8601: ' expires_at
BEGIN;
SET LOCAL app.tenant_id = 'platform';
INSERT INTO admin_recovery_approval_evidence
  (reference,target_tenant_id,target_slug,target_user_id,ticket,reason,valid_from,expires_at)
VALUES
  (:'reference',:'tenant_id',:'tenant_slug',:'target_id'::uuid,:'ticket',:'reason',
   :'valid_from'::timestamptz,:'expires_at'::timestamptz);
COMMIT;
```

Debe aparecer exactamente una fila insertada. Si el alcance o la identidad son erróneos, detener el caso y revocar con la misma cuenta: `BEGIN; SET LOCAL app.tenant_id = 'platform'; UPDATE admin_recovery_approval_evidence SET revoked_at=now() WHERE tenant_id='platform' AND reference=:'reference' AND revoked_at IS NULL; COMMIT;`. La revocación es definitiva y debe afectar exactamente una fila. El responsable comprueba en el ticket que la referencia, su cuenta personal y la ventana coinciden. Nunca reutilizar una referencia; V37 impone una sola autorización V33/V35 por referencia.

## Procedimiento manual previsto

1. El titular o representante abre un ticket por el canal de soporte registrado. Plataforma confirma su identidad por otro canal preexistente y coteja ID y slug del tenant `ACTIVE`, ausencia de ADMIN activos y UUID de un ADMIN preexistente e inactivo. No cambiar un MANAGER/STAFF a ADMIN ni crear una cuenta.
2. Otro responsable del proyecto aprueba en el ticket y registra V37 con su cuenta PostgreSQL personal mediante la plantilla anterior. El SUPER_ADMIN ejecutor consulta directamente el historial del ticket, comprueba autor, fecha, alcance y pertenencia de la cuenta personal a otra persona, y detiene el caso ante discrepancias. Una marca `approved=true` o un texto redactado por el ejecutor no basta.
3. Infraestructura verifica que V37 está migrada, `mapit_app` conserva solo `SELECT`, la cuenta personal es miembro del rol limitado y no pertenece al ejecutor. Hace un ensayo aislado con datos ficticios y Mailpit; después habilita temporalmente `mapit.admin-recovery.operator-endpoint-enabled=true` mediante configuración del despliegue y reinicia el backend. Si falta cualquiera de estos controles, el endpoint permanece apagado.
4. El SUPER_ADMIN vigente de `platform` se autentica por el mecanismo JWT existente y solicita `POST /api/v1/platform/admin-recoveries` con tenant ID/slug, ADMIN destinatario, ticket, motivo y referencia. La ruta vuelve a validar identidad y rol persistidos; `JdbcRecoveryApprovalSource` lee V37 bajo RLS de `platform`, rechaza evidencia revocada o ya usada y compara todo el alcance. Registra V33/V35 y pide a `IssueAdminRecoveryToken` la emisión en una sola transacción. La respuesta 202 contiene solo el ID de autorización; jamás devuelve enlace, token o contraseña. No poner JWT, token ni contraseña en ticket, argv o logs.
5. `IssueAdminRecoveryToken` bloquea autorización/tenant/ADMIN, confirma que no hay ADMIN activo y lee el correo **ya registrado** del destinatario. Genera un token aleatorio con prefijo `recover.` (el punto no pertenece al alfabeto de tokens de invitación), guarda solo SHA-256 en V36 bajo RLS de `platform`, ligado por FK a V33, y envía un enlace de 15 minutos como máximo al correo registrado mediante SMTP. La URL pública debe ser HTTPS; se acepta HTTP solo en localhost para desarrollo. La emisión es única por autorización. Si SMTP falla, la transacción revierte el token; si el resultado del transporte es ambiguo, abrir otro caso, no revelar ni reconstruir el secreto.
6. El titular abre el enlace `/activar` existente y establece personalmente su nueva contraseña. `POST /api/v1/auth/activate` distingue el token `recover.` del token de invitación; el request no elige usuario, rol ni actor de plataforma. En una transacción, el hash del token identifica la autorización y su tenant/ADMIN; se revalidan vigencia, revocación de V37 si existe, aprobación documental, SUPER_ADMIN activo, tenant `ACTIVE`, ADMIN inactivo y cero ADMIN activos. La lectura y la revocación de la referencia se serializan con un bloqueo transaccional. El núcleo fija hash BCrypt, corte `staff_tokens_valid_after`, activa solo esa cuenta, consume autorización y token y registra `USER_RECOVERED` con el SUPER_ADMIN real como actor bajo `platform`. El evento identifica tenant, usuario, ticket y motivo acotado; la FK de actor sigue en `platform` y no se inventa FK para el recurso polimórfico.
7. Ante token inválido, vencido o usado, conflicto concurrente, fallo de auditoría o condición alterada, toda la restauración revierte; no hay evento de éxito ni nueva capacidad de acceso. Detener y escalar, sin reintentar a ciegas ni ejecutar SQL compensatorio.
8. Tras commit, comprobar en otra sesión scoped al tenant que hay un ADMIN activo, que el titular puede iniciar sesión con la nueva contraseña y que la anterior y el JWT previo fallan. El corte JWT rechaza también un token emitido durante el mismo segundo; repetir el login en el segundo siguiente. Contrastar actor, destinatario, tenant, ticket y referencia V37 con el evento. Deshabilitar `mapit.admin-recovery.operator-endpoint-enabled` y reiniciar el backend; infraestructura revoca al responsable la pertenencia al rol de BD si terminó la ventana. Cerrar solo después de reconciliar la evidencia.

## Límites técnicos y cierre

`LastAdminPolicy` ya protege las operaciones ordinarias. V33/V35 conservan aprobación documental de un solo uso y V34 invalida JWT previos. V36 no reutiliza invitaciones `MEMBER`; su token queda ligado al alcance inmutable de V33. La restauración usa `mapit_app`, filtros `(tenant_id,id)`, `SET LOCAL app.tenant_id`, RLS, FK y bloqueo transaccional sin `BYPASSRLS`. No se modifica la base de desarrollo con historial Flyway divergente.

El código y la migración no crean ni asignan una cuenta personal de aprobación. La asignación autenticada y la separación de personas son pasos operativos obligatorios; un SUPER_ADMIN que también controle esa cuenta rompe el procedimiento. El ensayo PG17 verifica permisos y captura de `session_user`; la recepción SMTP solo se considera probada si se observa el mensaje en Mailpit. T12 no se inicia aquí.
