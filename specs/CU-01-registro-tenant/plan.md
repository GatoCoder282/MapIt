# CU-01 — Plan técnico

## 1. Enfoque

El registro se implementará en el bounded context `platform` siguiendo la arquitectura
hexagonal existente. El contrato OpenAPI será la fuente de verdad; después se añadirán
el dominio, la persistencia, el caso de uso, los adaptadores REST y SMTP, y finalmente
la feature Angular. La tabla `tenant` ya existe en `V1__baseline.sql`, por lo que no se
creará una tabla duplicada: solo se añadirá una migración evolutiva para `vertical`.

JWT y RBAC quedan preparados por la protección autenticada existente, pero se implementan
en CU-23/CU-24.

## 2. Patrones de diseño aplicados

| Patrón           | Dónde                           | Por qué aquí                                                                 | Alternativa descartada                                                             |
| ---------------- | ------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Ports & Adapters | `platform`                      | Mantiene dominio y aplicación independientes de JPA, REST y SMTP.            | Inyectar `JavaMailSender` o un repositorio Spring directamente en `TenantService`. |
| Repository       | `TenantRepository`              | Expresa la persistencia requerida por el caso de uso sin conocer PostgreSQL. | Consultas JPA dentro de `TenantService`.                                           |
| Adapter          | Adaptador SMTP                  | Aísla Mailpit/SMTP de la lógica de registro.                                 | Acoplar el caso de uso a una implementación de correo concreta.                    |
| Value Object     | `TenantId` y `BusinessVertical` | Evita confundir IDs de texto y limita valores válidos.                       | Usar `String` y validaciones dispersas.                                            |

## 3. Cambios en el contrato API

| Método | Ruta              | Descripción                              |
| ------ | ----------------- | ---------------------------------------- |
| POST   | `/api/v1/tenants` | Registra un tenant y envía confirmación. |

## 3.1 Iteraciones y ramas

La rama de integración personal es `feat/GatoCoder282/MAP-33-registro-tenant`.
Cada rama siguiente representa el alcance de una iteración/PR y conserva una
historia pequeña y revisable. El orden recomendado es el siguiente:

| Iteración / PR | Rama                                                | Qué resuelve                                                                    | Dónde se resuelve                                                    | Jira           |
| -------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------- |
| 0              | `feat/GatoCoder282/MAP-33-spec-contract`            | Define request, response y errores antes del código.                            | `packages/api-contract/openapi.yaml`, `specs/CU-01-registro-tenant/` | MAP-33         |
| 1              | `feat/GatoCoder282/MAP-34-tenant-domain`            | Modela tenant, vertical, estado e identificador generado.                       | `shared-kernel`, `platform-domain`                                   | MAP-34         |
| 2              | `feat/GatoCoder282/MAP-35-tenant-persistence`       | Persiste el tenant sin duplicar V1 y mantiene `slug` único.                     | `V3__agregar_vertical_a_tenant.sql`, `platform-infrastructure`, DBML | MAP-35         |
| 3              | `feat/GatoCoder282/MAP-36-tenant-service`           | Orquesta validación de unicidad, creación y notificación.                       | `platform-application`                                               | MAP-36         |
| 4              | `feat/GatoCoder282/MAP-37-tenant-api`               | Expone `POST /api/v1/tenants` y sus validaciones RFC 9457.                      | `TenantController` y contrato generado                               | MAP-37, MAP-38 |
| 5              | `feat/GatoCoder282/MAP-39-tenant-email`             | Envía confirmación por SMTP/Mailpit sin acoplar el caso de uso.                 | Puerto de dominio y adaptador SMTP                                   | MAP-39         |
| 6              | `feat/GatoCoder282/MAP-40-tenant-registration-form` | Añade formulario, estado Signals y navegación en consola.                       | `apps/console/.../tenant-registration`                               | MAP-40, MAP-41 |
| 7              | `feat/GatoCoder282/MAP-41-tenant-api-integration`   | Comprueba el contrato REST del controlador.                                     | `TenantControllerTest`                                               | MAP-44         |
| 8              | `feat/GatoCoder282/MAP-42-tenant-isolation`         | Comprueba persistencia HTTP, slug duplicado y compatibilidad con RLS existente. | `TenantApiIntegrationTest`, `DemoItemIsolationIntegrationTest`       | MAP-42, MAP-43 |

Las ramas de iteración ya fueron integradas localmente en la rama personal para
dejar un worktree ejecutable. Si se publican como PRs apilados, se deben revisar
en el mismo orden de la tabla y mantener como destino la rama de integración
personal hasta cerrar cada iteración.

## 4. Backend

**Módulo:** `platform`

| Capa                      | Qué se añade                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `platform-domain`         | `Tenant`, `BusinessVertical`, `TenantStatus`, `TenantRepository` y puerto de correo. |
| `platform-application`    | `TenantService`, comando de registro y excepciones de conflicto/notificación.        |
| `platform-infrastructure` | Entidad JPA, repositorio Spring Data, adaptadores REST y SMTP.                       |

## 5. Base de datos

- `tenant` es una tabla global, por lo que no lleva `tenant_id` ni RLS.
- No se modifica una migración ya existente.
- Se añadirá `vertical` con restricción para las cuatro verticales.
- `id` conserva su PK y `slug` conserva su restricción única.
- `docs/db/mapit.dbml` se actualiza junto con la migración.

## 6. Frontend

**App:** `console` · **Feature:** `administration/tenant-registration`

| Parte    | Qué se añade                                               |
| -------- | ---------------------------------------------------------- |
| `model/` | Store con Signals para formulario, envío, éxito y errores. |
| `ui/`    | Formulario con nombre, slug, vertical y correo.            |
| `data/`  | Adaptador sobre el cliente generado de OpenAPI.            |

## 7. Feature toggle

No se añade feature flag: el registro es una capacidad base de plataforma.

## 8. Testing

| Nivel              | Qué se prueba                                                                        |
| ------------------ | ------------------------------------------------------------------------------------ |
| Unit               | Reglas de `Tenant`, `TenantId` y `TenantService`.                                    |
| Integración        | Migración, persistencia, API, duplicados y errores.                                  |
| Aislamiento tenant | Se conserva la prueba RLS existente; la prueba A/B de usuarios depende de identidad. |
| Frontend           | Store de registro con Vitest.                                                        |
| E2E                | No se añade; QA valida el flujo según su estrategia.                                 |

Las pruebas automáticas incluidas son evidencia técnica del desarrollo. No
reemplazan el trabajo de QA: la aceptación manual, el flujo completo con rol de
Administrador de Plataforma, la recepción visual del correo y la prueba
funcional usuario A/usuario B quedan para QA. El endpoint no se abre al público;
JWT/RBAC se completa en CU-23/CU-24.

## 9. Riesgos

| Riesgo                                     | Mitigación                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| Duplicar `tenant` en Flyway                | Revisar versiones actuales y usar una migración aditiva.                    |
| Confundir correo de registro con identidad | Mantenerlo request-only hasta CU-23/CU-24.                                  |
| Registrar sin autorización de rol          | No abrir el endpoint; la autorización Super Admin se completa con identity. |
