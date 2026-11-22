# HU-1.05 — Solicitud y aprobación de incorporación de negocios

> Jira: [MAP-257](https://matiasmv2005.atlassian.net/browse/MAP-257). Subtareas: MAP-261 a MAP-267.

## Historia

Como representante de un negocio, quiero solicitar su incorporación a MapIt y conocer el resultado para que un administrador de plataforma revise mi solicitud antes de habilitar una empresa y su primer administrador.

## Contexto y límites

- El inicio de sesión unificado de HU-1.03 ya está integrado. Su especificación actual deja el registro autónomo de empresas fuera de alcance; esta historia introduce un proceso de solicitud con revisión humana.
- CU-25/MAP-180 ya provee invitación y activación del primer `ADMIN`. La aprobación debe reutilizar ese mecanismo; no se envían contraseñas por correo.
- El alta directa de tenants de CU-01 sigue siendo una operación de plataforma. La solicitud pública no llama a esa operación antes de ser aprobada.
- La flag `mapit.s6.business-applications` controla la entrada pública y la creación de solicitudes. Su valor inicial y su fallback ante fallo de Unleash son `OFF`.

## Flujo esperado

1. Un visitante envía datos mínimos del negocio y un correo de contacto. Recibe una respuesta neutra que no revela si el negocio o el correo ya están registrados.
2. Una solicitud aceptada se guarda como `PENDING`. No crea tenant, establecimiento, usuario ni sesión.
3. Un `SUPER_ADMIN` consulta la bandeja, revisa la solicitud y decide aprobar o rechazar. Cada decisión deja actor, fecha y resultado auditables.
4. Al aprobar, el sistema verifica las condiciones de seguridad, crea o vincula exactamente un tenant y genera la invitación del primer `ADMIN` mediante CU-25. Repetir la misma decisión no crea duplicados.
5. El solicitante recibe una notificación de resultado sin datos internos ni credenciales. La activación del `ADMIN` conserva el flujo de token de un solo uso de CU-25.

## Criterios de aceptación

- [x] Dada la flag `OFF` o Unleash indisponible, cuando un visitante abre la entrada pública o envía una solicitud, entonces la UI no ofrece el formulario y la API rechaza nuevas solicitudes sin cambiar las existentes.
- [x] Dada la flag `ON`, cuando un visitante envía nombre comercial, vertical, ubicación y contacto válidos, entonces recibe una confirmación neutra y queda una solicitud `PENDING` sin tenant, establecimiento ni usuario nuevo.
- [x] Dados datos inválidos, un duplicado o exceso de solicitudes, cuando se intenta enviar, entonces la API valida y limita el abuso sin revelar si ya existe un correo o negocio.
- [x] Dado un usuario que no es `SUPER_ADMIN`, cuando intenta listar, consultar o decidir una solicitud, entonces recibe rechazo y no accede a datos de solicitantes.
- [x] Dado un `SUPER_ADMIN`, cuando filtra y revisa solicitudes pendientes, entonces ve sus datos necesarios y el estado actual; la lectura no depende de que la flag pública siga encendida.
- [x] Dada una solicitud `PENDING` verificada de forma segura, cuando el `SUPER_ADMIN` la aprueba, entonces se crea o vincula exactamente un tenant y se emite una única invitación al primer `ADMIN`; repetir la aprobación conserva el mismo resultado.
- [x] Dada una solicitud `PENDING`, cuando el `SUPER_ADMIN` la rechaza, entonces pasa a `REJECTED`, queda el motivo/actor/fecha auditables y no se crea tenant ni invitación.
- [x] Dadas dos decisiones concurrentes sobre la misma solicitud, cuando ambas llegan al servidor, entonces solo una transición gana y no se duplican tenants ni invitaciones.
- [x] Dada una solicitud de otra empresa, cuando un usuario de tenant intenta acceder a ella, entonces el backend y PostgreSQL impiden la lectura o modificación; las pruebas comprueban el aislamiento con el rol de runtime.
- [x] Dado un resultado de aprobación o rechazo, cuando se envía la notificación, entonces el correo no contiene contraseña, token de sesión ni datos de otras solicitudes.
- [x] Dada una solicitud previa, cuando la flag pasa de `ON` a `OFF`, entonces las decisiones administrativas y la trazabilidad continúan disponibles sin pérdida de datos.
- [x] Dados los flujos completos, cuando se ejecutan pruebas unitarias, integración y smoke E2E, entonces quedan registrados resultados y evidencia reproducible, incluidos los casos negativos de rol, tenant, duplicados y concurrencia.

## Seguridad y datos

- La solicitud pública no confía en un `tenant_id` enviado por el navegador. Los datos anteriores a la aprobación se mantienen en un ámbito de plataforma aislado; cualquier tabla nueva tendrá `tenant_id NOT NULL`, índice `(tenant_id, id)` y RLS.
- La decisión requiere JWT con rol `SUPER_ADMIN`. La flag no sustituye la autorización ni el aislamiento.
- La respuesta pública y los correos se diseñan para reducir enumeración de cuentas y exposición de datos sensibles.
- El cambio de flag no borra solicitudes ni revierte aprobaciones.

## Fuera de alcance

Autorregistro que conceda acceso sin revisión, credenciales bancarias, contraseñas temporales por correo y nuevas formas de autenticación ajenas a HU-1.03/CU-25.

## Decisión sobre la verificación segura

La solicitud exige verificar el correo de contacto antes de aprobarla. Después, CU-25 invita al primer `ADMIN` a establecer su contraseña con otro token de un solo uso. Las pruebas de integración comprueban que una solicitud sin contacto verificado no se puede aprobar.
