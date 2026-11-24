# Plan — HU-1.05 Solicitud y aprobación de incorporación de negocios

## Secuencia de entrega

Las ramas se apilan en el orden MAP-261 → MAP-262 → MAP-263 → MAP-264 → MAP-265 → MAP-266 → MAP-267. Cada MAP tendrá su propia rama y pruebas pertinentes. La rama de la historia contiene la especificación y este plan; la integración final se hará mediante PR, sin fusionar automáticamente.

## Decisiones

1. **Ámbito previo a la aprobación.** `business_application` pertenece al tenant técnico `platform`. El visitante no envía ni conoce `tenant_id`. El servicio de solicitudes fija ese ámbito de forma interna; RLS y filtros explícitos evitan exponer solicitudes a tenants de negocio.
2. **Verificación del contacto.** La aprobación exige `contact_verified_at`. MAP-262 emitirá un enlace de verificación de un solo uso para el correo; en la base solo se guarda su hash y caducidad. MAP-265 no podrá aprobar un contacto sin verificar. La invitación de CU-25 es un segundo paso: permite que el primer `ADMIN` establezca su contraseña.
3. **Estado y trazabilidad.** El modelo admite `PENDING`, `APPROVED` y `REJECTED`. Una decisión guarda actor, instante y, si corresponde, motivo o tenant aprobado. MAP-265 agregará el evento inmutable a la bitácora, además de estos campos de consulta.
4. **Idempotencia y concurrencia.** La decisión se hará en una transacción que bloquea la fila de la solicitud y usa el mismo resultado ante reintentos. Un índice único impide dos solicitudes pendientes para el mismo correo y negocio normalizados. Los tenants e invitaciones se crearán mediante los casos de uso existentes, no mediante SQL directo desde el controlador.
5. **Flag.** `mapit.s6.business-applications` inicia `OFF` y falla cerrada. El backend comprueba la flag al crear solicitudes; la bandeja y decisiones administrativas siguen disponibles con la flag apagada.

## Módulos y contrato

| Entrega | Ubicación                                           | Responsabilidad                                                                                                             |
| ------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| MAP-261 | `platform-domain`, Flyway, `docs/db/mapit.dbml`     | Modelo, estados, invariantes y tabla con RLS.                                                                               |
| MAP-262 | OpenAPI, `platform-application` e `-infrastructure` | Envío público, validación, antiabuso y verificación del contacto. El contrato se modifica primero y se regenera el cliente. |
| MAP-263 | `apps/public-web`                                   | Formulario público accesible y estados de envío, bajo la flag.                                                              |
| MAP-264 | OpenAPI, `platform-*`, `apps/console`               | Bandeja y consulta exclusiva de `SUPER_ADMIN`.                                                                              |
| MAP-265 | `platform-*`, CU-25 y bitácora                      | Decisión transaccional, tenant/invitación y auditoría.                                                                      |
| MAP-266 | Adaptadores de correo, pruebas IT y E2E             | Resultado al solicitante y pruebas completas de seguridad/concurrencia.                                                     |
| MAP-267 | Unleash, catálogos de flags y pruebas               | OFF/ON, fallback y rollback sin pérdida de solicitudes.                                                                     |

## MAP-261 — Esquema inicial

`business_application` tendrá `id`, `tenant_id`, nombre comercial, vertical, ubicación, nombre/correo/teléfono de contacto, estado, hash y caducidad de verificación, fecha de verificación, actor/fecha de decisión, motivo de rechazo, `approved_tenant_id`, y marcas de creación/actualización. La migración impondrá estados válidos y coherencia entre estado y campos de decisión, índice `(tenant_id, id)`, índice de bandeja y unicidad parcial de solicitudes pendientes. RLS se habilitará con `enable_tenant_isolation` y la tabla tendrá `tenant_id = 'platform'` hasta que se decida otra política explícita.

## Patrones de diseño aplicados

| Patrón                                         | Por qué aquí                                                                               | Alternativa descartada                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Value Object / entidad inmutable               | El estado de la solicitud y sus decisiones deben conservar invariantes antes de persistir. | Record con campos públicos sin validación de transiciones. |
| Repository (puerto y adaptador, desde MAP-262) | Los casos de uso necesitan buscar, bloquear y guardar sin acoplar el dominio a JDBC.       | SQL dentro del controlador o del dominio.                  |
| Ports & Adapters                               | Correo, flags y persistencia se conectan desde infraestructura y se prueban con dobles.    | Importar SMTP, Unleash o Spring en el dominio.             |

## Verificación

MAP-261: tests unitarios de invariantes, migración con Testcontainers y aislamiento RLS usando el rol `mapit_app`; `pnpm be:test`, `pnpm be:it` pertinente, `pnpm check`. Después de cada MAP: checks aplicables y notas en `tasks.md`. Antes de revisión final: CI completo, E2E y captura de Checks verdes del PR.
