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

## 9. Riesgos

| Riesgo                                     | Mitigación                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| Duplicar `tenant` en Flyway                | Revisar versiones actuales y usar una migración aditiva.                    |
| Confundir correo de registro con identidad | Mantenerlo request-only hasta CU-23/CU-24.                                  |
| Registrar sin autorización de rol          | No abrir el endpoint; la autorización Super Admin se completa con identity. |
