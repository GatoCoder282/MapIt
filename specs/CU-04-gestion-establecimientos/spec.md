# CU-04 — Gestión de Establecimientos

> **Estado:** Borrador · **Creada:** 2026-09-09 · **Responsable:** Diego Trigo
>
> Historia de usuario **HU-2.01** · Subtareas **MAP-54** … **MAP-59**

## Enunciado

Como Administrador de un Tenant quiero registrar y administrar establecimientos para
representar físicamente los lugares que utilizarán MapIt.

**CU-04** del roadmap: crear establecimiento y elegir su tipo (restaurante, discoteca,
salón de eventos, hotel).

---

## 1. Por qué

El establecimiento es la primera entidad **de negocio** de MapIt: sin él no hay dónde
colgar pisos, sectores ni elementos de mapa. CU-01 crea la empresa (tenant), pero una
empresa sin establecimientos no puede operar nada.

Además, el campo `type` decide qué plantillas de elemento aplican más adelante (CU-07):
una discoteca ofrece "Zona VIP" y un hotel "Habitación". Elegir mal el tipo condiciona
todo el editor de mapas, así que la decisión se toma aquí y queda registrada.

## 2. Actores

| Rol                        | Qué hace en este caso de uso                                                |
| -------------------------- | --------------------------------------------------------------------------- |
| Administrador (de empresa) | Registra, consulta, actualiza y da de baja los establecimientos del tenant. |

## 3. Precondiciones

- El tenant existe y está en estado `ACTIVE`.
- La petición se resuelve dentro de un contexto de tenant conocido (`TenantContext`).
- El nombre, el tipo y el slug enviados son válidos.
- El slug no pertenece a otro establecimiento vivo del mismo tenant.

## 4. Flujo principal

1. El administrador abre la pantalla de establecimientos y ve los de su tenant.
2. Completa el formulario con nombre, tipo, slug y zona horaria.
3. El backend valida los datos y genera un identificador que no proviene del cliente.
4. El sistema guarda el establecimiento asociado al tenant del contexto y registra la
   autoría y la fecha de creación.
5. La API devuelve el establecimiento creado y la pantalla lo muestra en la lista.

## 5. Flujos alternativos y errores

| Situación                                        | Comportamiento esperado                                           |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| Nombre, tipo, slug o zona horaria inválidos      | Respuesta `400` con Problem Details.                              |
| Slug ya usado por otro establecimiento vivo      | Respuesta `409`; no se crea un segundo registro.                  |
| Identificador inexistente en consulta o edición  | Respuesta `404` con Problem Details.                              |
| Identificador de otro tenant                     | Respuesta `404`, nunca `403`: no se revela que el recurso existe. |
| Se da de baja un establecimiento ya dado de baja | Respuesta `404`; la operación es idempotente hacia el cliente.    |
| Falta contexto de tenant                         | Respuesta `401`; ninguna consulta devuelve filas sin tenant.      |

## 6. Reglas de negocio

- **RN-1:** El identificador del establecimiento lo genera el backend; el cliente no
  puede elegirlo.
- **RN-2:** Todo establecimiento pertenece a exactamente un tenant, tomado del contexto
  de la petición y **nunca** del cuerpo del mensaje.
- **RN-3:** El tipo es uno de `RESTAURANT`, `NIGHTCLUB`, `EVENT_HALL` o `HOTEL`. Es
  inmutable tras la creación: cambiarlo invalidaría las plantillas de elemento (CU-07)
  y los mapas ya dibujados.
- **RN-4:** El slug usa minúsculas, dígitos y guiones, y es único **entre los
  establecimientos vivos** de un mismo tenant. Dos tenants distintos pueden repetirlo.
- **RN-5:** La baja es **lógica**: la fila se conserva y se marca con fecha y autor de
  borrado. Un establecimiento dado de baja no aparece en consultas ni bloquea su slug.
- **RN-6:** Toda fila registra **quién y cuándo** la creó, la modificó por última vez y,
  si aplica, la dio de baja.
- **RN-7:** La zona horaria por defecto es `America/La_Paz` y debe ser un identificador
  IANA válido.

## 7. Criterios de aceptación

- [x] **CA-1:** Dado un administrador autenticado, cuando registra un establecimiento
      con datos válidos, entonces queda asociado al tenant de su contexto y la API
      devuelve `201` con el identificador generado por el backend.
- [x] **CA-2:** Dado un tenant con establecimientos propios y ajenos en la base, cuando
      el administrador consulta sus establecimientos, entonces solo recibe los de su
      tenant.
- [x] **CA-3:** Dado un establecimiento existente, cuando el administrador actualiza su
      nombre, slug o zona horaria, entonces los cambios quedan guardados y `updated_at`
      y `updated_by` reflejan la modificación.
- [x] **CA-4:** Dado un establecimiento existente, cuando se envía un `type` en la
      petición de actualización, entonces se ignora y el tipo original se conserva.
      Ver la nota al final de esta sección.
- [x] **CA-5:** Dado un slug ya usado por un establecimiento vivo del mismo tenant,
      cuando se intenta crear otro con ese slug, entonces la API responde `409` y
      persiste un solo registro.
- [x] **CA-6:** Dado un establecimiento dado de baja, cuando el administrador consulta
      la lista, entonces no aparece; y cuando se consulta la tabla directamente, la
      fila sigue existiendo con `deleted_at` informado.
- [x] **CA-7:** Dado un slug liberado por una baja lógica, cuando se crea un
      establecimiento nuevo con ese mismo slug, entonces la operación tiene éxito.
- [x] **CA-8:** Dado un identificador que pertenece a otro tenant, cuando se consulta o
      actualiza, entonces la API responde `404`.
- [x] **CA-9:** Dado el contexto de tenant A, cuando se consulta la tabla
      `establishment`, entonces la RLS de PostgreSQL no devuelve ninguna fila del
      tenant B, aunque la consulta omita el filtro por `tenant_id`.

**Nota sobre CA-4, corregida durante la ejecución.** La primera redacción exigía un
`400` al enviar `type` en la actualización. Se descartó: rechazar campos desconocidos
rompería el patrón habitual _GET → modificar → PUT_, en el que el cliente reenvía el
objeto completo incluyendo `id` y `createdAt`. La invariante RN-3 se garantiza igual, y
antes: el esquema `EstablishmentUpdateRequest` no declara `type`, así que no hay forma
de que llegue al dominio.

## 8. Fuera de alcance

- **Autenticación y autorización por rol.** Corresponde a CU-23/CU-24. Mientras tanto el
  tenant se resuelve con el adaptador temporal ya existente (`DemoTenantContext`) y las
  columnas de autoría se persisten nulas. Ver §9.
- **Pisos y sectores** dentro del establecimiento; corresponde a CU-05.
- **Plantillas de elemento** según el tipo; corresponde a CU-07.
- **Borrado físico** y purga de establecimientos dados de baja.
- **Reactivar** un establecimiento dado de baja.
- **Paginación y búsqueda** en el listado: se espera un puñado de establecimientos por
  tenant, no miles.
- Cambiar el tipo del establecimiento tras crearlo (ver RN-3).
- Pruebas manuales y de aceptación funcional, que corresponden a QA.

## 9. Impacto multi-tenant

- La tabla `establishment` es **tenant-scoped**: lleva `tenant_id TEXT NOT NULL`
  referenciando `tenant(id)`, índice compuesto `(tenant_id, id)` y RLS activada con
  `SELECT enable_tenant_isolation('establishment')`, igual que `demo_item`.
- El `tenant_id` se toma del `TenantContext` del servidor y jamás del cuerpo de la
  petición: si el cliente lo enviara, se ignora.
- La unicidad del slug es **por tenant**, mediante índice único parcial sobre
  `(tenant_id, slug)` restringido a las filas vivas.
- **Sí hay test de aislamiento:** un test de integración con Testcontainers inserta
  filas de dos tenants y comprueba, bajo un rol no privilegiado, que con
  `app.tenant_id = 'demo'` no se ve ninguna fila del otro tenant. Sigue el patrón de
  `DemoItemIsolationIntegrationTest`.
- **Autoría sin autenticación:** `created_by`, `updated_by` y `deleted_by` se crean como
  `UUID` nullable **sin clave foránea**, porque la tabla `app_user` todavía no existe
  (llega en CU-23/CU-24). La migración que cree `app_user` añadirá las tres FK. Hasta
  entonces las columnas se persisten nulas y el dominio las trata como opcionales.

## 10. Requerimientos relacionados

RF01 de `docs/roadmap/project_definition.md` ("crear un establecimiento y definir su
tipo"). Aislamiento por tenant según `ADR-0004-multi-tenant.md`. Metodología según
`ADR-0007-spec-driven-development.md`.
