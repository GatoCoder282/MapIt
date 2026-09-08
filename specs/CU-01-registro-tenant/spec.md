# CU-01 — Registro de Tenant

> **Estado:** En desarrollo · **Creada:** 2026-09-03 · **Responsable:** Diego Valdez

## Enunciado

Como Administrador de Plataforma quiero registrar un nuevo Tenant para que una
organización pueda comenzar a utilizar MapIt de forma aislada.

## 1. Por qué

MapIt necesita crear la organización antes de que existan establecimientos y datos
operativos asociados. El registro genera la identidad estable de la organización,
define su vertical inicial y notifica al administrador indicado.

## 2. Actores

| Rol                         | Qué hace en este caso de uso                              |
| --------------------------- | --------------------------------------------------------- |
| Administrador de Plataforma | Envía los datos de la organización y su vertical inicial. |

## 3. Precondiciones

- La solicitud contiene nombre, slug, vertical y correo válidos.
- El slug no pertenece a otro tenant.
- El endpoint se consume dentro del contexto autenticado disponible para la plataforma.

## 4. Flujo principal

1. El administrador completa el formulario de registro.
2. El backend valida los datos y genera un `TenantId` que no proviene del cliente.
3. El sistema guarda el tenant con estado inicial `ACTIVE`.
4. El sistema envía un correo de confirmación al administrador.
5. La API devuelve el tenant creado sin exponer datos técnicos del correo.

## 5. Flujos alternativos y errores

| Situación                                 | Comportamiento esperado                                    |
| ----------------------------------------- | ---------------------------------------------------------- |
| Nombre, slug, vertical o correo inválidos | Respuesta `400` con Problem Details.                       |
| Slug ya registrado                        | Respuesta `409` sin crear un segundo tenant.               |
| Falla el envío de correo                  | Respuesta `503`; la operación no se confirma como exitosa. |
| Falta autenticación                       | Respuesta `401`; no se abre el endpoint al público.        |

## 6. Reglas de negocio

- **RN-1:** El `TenantId` se genera en backend y el cliente no puede elegirlo.
- **RN-2:** Los slugs son únicos y usan minúsculas, dígitos y guiones.
- **RN-3:** La vertical es una de `RESTAURANT`, `NIGHTCLUB`, `EVENT_HALL` o `HOTEL`.
- **RN-4:** Todo tenant nuevo comienza en estado `ACTIVE`.
- **RN-5:** El correo del administrador se utiliza para la notificación, pero se
  persistirá como usuario en CU-23/CU-24.

## 7. Criterios de aceptación

- [ ] **CA-1:** Dado un formulario válido, cuando se envía, entonces se crea un tenant
      con un `TenantId` generado por el backend.
- [ ] **CA-2:** Dado un tenant creado, cuando se consulta la base de datos, entonces sus
      nombre, slug, vertical, estado y fechas están almacenados correctamente.
- [ ] **CA-3:** Dado un registro exitoso, cuando el servicio de correo está disponible,
      entonces el administrador recibe un correo de confirmación.
- [ ] **CA-4:** Dado un slug existente, cuando se intenta registrar otro tenant con el
      mismo slug, entonces la API responde `409` y conserva un solo registro.
- [ ] **CA-5:** Dado un usuario del Tenant A, cuando consulta datos tenant-scoped del
      Tenant B, entonces no recibe información del Tenant B.

## 8. Fuera de alcance

- Autenticación JWT y autorización completa por rol; corresponde a CU-23/CU-24.
- Creación del `app_user` administrador; corresponde a CU-23/CU-24.
- Listado, suspensión o reactivación de tenants; corresponde a CU-03.
- Creación de establecimientos; corresponde a CU-04.
- Reintentos, tokens de verificación u outbox de correo.
- Pruebas manuales y pruebas de aceptación, que corresponden a QA.

## 9. Impacto multi-tenant

- La tabla `tenant` es global y no lleva `tenant_id` ni RLS: el registro crea el
  contexto que después aislará las tablas de negocio.
- El aislamiento se verifica sobre datos tenant-scoped; la prueba RLS existente se
  conserva y la comprobación usuario A/B queda condicionada a CU-23/CU-24.

## 10. Requerimientos relacionados

RF16, RF17, RNF09 y RNF11 de `docs/roadmap/project_definition.md`.
