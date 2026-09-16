# CU-05 — Gestión de Pisos y Sectores

> **Estado:** Borrador · **Creada:** 2026-09-12 · **Responsable:**

## Enunciado

Este caso de uso describe la funcionalidad para la gestión de Pisos y su subdivisión en Sectores dentro del sistema MapIT. Una Planta (Floor) representa un nivel físico dentro de un establecimiento, y los Sectores permiten una gestión espacial más granular dividiendo los pisos en áreas más pequeñas y manejables. Cada Sector pertenece a exactamente un Piso, y un Piso puede tener múltiples Sectores. Esta estructura es esencial para operaciones detalladas como la asignación de mesas en un restaurante, la definición de zonas de baile en una discoteca o la organización de áreas en un hotel.

---

## 1. Por qué (contexto)

Actualmente, la gestión espacial se limita a Pisos. Para operaciones más detalladas, como la asignación de mesas en un restaurante, la definición de zonas de baile en una discoteca o la organización de áreas en un hotel, es necesario poder dividir los pisos en secciones más pequeñas y manejables. La entidad Sector permitirá esta granularidad, mejorando la operatividad y la visualización del espacio. El Piso (Floor) es el contenedor superior que agrupa estos sectores dentro de un establecimiento.

---

## 2. Actores

| Rol           | Qué hace en este caso de uso                                                                                                                     |
| :------------ | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| Administrador | Puede crear, editar y visualizar Pisos y Sectores. Puede asociar nuevos Sectores a un Piso existente y visualizar la lista de Sectores por Piso. |

---

## 3. Precondiciones

- El administrador debe estar autenticado en el sistema.
- El administrador debe tener los permisos necesarios para gestionar la configuración espacial (Pisos y Sectores).
- Debe existir un Piso (Floor) al cual asociar nuevos Sectores, o el Piso se creará como parte de este flujo.
- El `tenant_id` debe estar resolverse del claim `tenant` del JWT para el aislamiento multi-tenant.

---

## 4. Flujo principal

1.  El administrador accede a la sección de gestión de configuración espacial.
2.  El administrador selecciona un Piso existente para el cual desea gestionar sus Sectores, o crea un nuevo Piso si no existe.
3.  El sistema muestra la lista actual de Sectores asociados a ese Piso (si los hay).
4.  El administrador inicia la acción para crear un nuevo Sector, proporcionando únicamente el nombre para el Sector (ej. "Terraza Norte").
5.  El sistema (frontend) autogenera el slug de forma transparente a partir del nombre ingresado (ej. convirtiendo "Terraza Norte" a "terraza-norte").
6.  El sistema valida la información ingresada (incluyendo la unicidad del slug generado) según las reglas de negocio.
7.  Si la validación es exitosa, el sistema crea el nuevo Sector y lo asocia al Piso seleccionado.
8.  El sistema actualiza y muestra la lista de Sectores para el Piso seleccionado, incluyendo el nuevo Sector.

---

## 5. Flujos alternativos y errores

| Situación                                                                                                              | Comportamiento esperado                                                                                        |
| :--------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| El nombre del Sector excede los 100 caracteres.                                                                        | El sistema muestra un mensaje de error indicando la restricción de longitud del nombre y el Sector no se crea. |
| El nombre del Piso excede los 100 caracteres.                                                                          | El sistema muestra un mensaje de error indicando la restricción de longitud del nombre y el Piso no se crea.   |
| El slug del Sector ya existe para el mismo `floor_id`.                                                                 | El sistema muestra un mensaje de error indicando que el slug ya existe para ese Piso y el Sector no se crea.   |
| El slug del Piso ya existe dentro del mismo `tenant_id`.                                                               | El sistema muestra un mensaje de error indicando que el slug del Piso ya existe y el Piso no se crea.          |
| El `floor_id` seleccionado no existe en el sistema.                                                                    | El sistema muestra un mensaje de error indicando que el Piso no fue encontrado y el Sector no se crea.         |
| El administrador intenta crear un Sector sin los permisos adecuados.                                                   | El sistema muestra un mensaje de error de "Acceso denegado" y la operación no se completa.                     |
| El slug del Sector contiene caracteres no permitidos o tiene un formato inválido (solo minúsculas, números y guiones). | El sistema muestra un mensaje de error indicando el formato inválido del slug y el Sector no se crea.          |
| El administrador intenta crear un Piso con un nombre que ya existe para el mismo `tenant_id`.                          | El sistema muestra un mensaje de error indicando que el nombre o slug del Piso ya existe y el Piso no se crea. |

---

## 6. Reglas de negocio

- **RN-1:** El Piso debe pertenecer a un `tenant_id` específico.
- **RN-2:** El Sector debe pertenecer a un `tenant_id` específico.
- **RN-3:** El Sector debe estar asociado a un `floor_id` específico.
- **RN-4:** El nombre del Piso no debe exceder los 100 caracteres.
- **RN-5:** El nombre del Sector no debe exceder los 100 caracteres.
- **RN-6:** El slug del Piso debe ser único dentro del mismo `tenant_id`.
- **RN-7:** El slug del Sector debe ser único dentro del mismo `floor_id`.
- **RN-8:** Un Sector no puede existir sin estar asociado a un Piso (FK constraint).
- **RN-9:** Un Piso puede tener muchos Sectores, pero cada Sector pertenece a exactamente un Piso.

---

## 7. Criterios de aceptación

- [ ] **CA-1:** Dado que un administrador está en la sección de gestión de pisos y selecciona un piso existente, cuando crea un nuevo sector proporcionando un nombre válido (ej. "Zona VIP"), el sistema genera automáticamente el slug ("zona-vip") y el sector se crea exitosamente, mostrándose en la lista.
- [ ] **CA-2:** Dado que un administrador está en la sección de gestión de pisos y crea un nuevo piso con un nombre válido, el sistema genera automáticamente el slug del piso y el piso se crea exitosamente.
- [ ] **CA-3:** Dado que un administrador está en la sección de gestión de pisos, cuando intenta crear un nuevo sector con un nombre que excede los 100 caracteres, entonces el sistema muestra un mensaje de error indicando la restricción de longitud del nombre y no se crea el sector.
- [ ] **CA-4:** Dado que un administrador está en la sección de gestión de pisos, cuando intenta crear un nuevo piso con un nombre que excede los 100 caracteres, entonces el sistema muestra un mensaje de error indicando la restricción de longitud del nombre y no se crea el piso.
- [ ] **CA-5:** Dado que ya existe un sector con el slug "zona-vip" en el piso seleccionado, cuando el sistema intenta generar automáticamente un slug para un nuevo sector (ej. nombre "Zona VIP") que resultaría en "zona-vip", entonces el sistema muestra un mensaje de error indicando que el slug ya existe para ese piso y no se crea el sector.
- [ ] **CA-6:** Dado que ya existe un piso con el slug "planta-baja" en el mismo tenant, cuando el sistema intenta crear un nuevo piso con un nombre que resultaría en el mismo slug, entonces el sistema muestra un mensaje de error indicando que el slug ya existe y no se crea el piso.
- [ ] **CA-7:** Dado que un administrador está intentando crear un sector, cuando selecciona un `floor_id` que no existe en el sistema, entonces el sistema muestra un mensaje de error indicando que el piso no fue encontrado y no se crea el sector.
- [ ] **CA-8:** Dado que un administrador está intentando crear un piso, cuando proporciona un nombre duplicado, entonces el sistema muestra un mensaje de error indicando que el nombre o slug del piso ya existe y no se crea el piso.
- [ ] **CA-9:** Dado que se ha creado exitosamente un nuevo sector en un piso, cuando el administrador visualiza la lista de sectores para ese piso, entonces el nuevo sector aparece en la lista con su nombre y slug.
- [ ] **CA-10:** Dado que se ha creado exitosamente un nuevo piso, cuando el administrador visualiza la lista de pisos, entonces el nuevo piso aparece en la lista con su nombre y slug.
- [ ] **CA-11:** Dado que existen sectores en varios pisos diferentes, cuando el administrador visualiza la lista de sectores de un piso específico, entonces solo se muestran los sectores pertenecientes a ese piso y no a otros.
- [ ] **CA-12:** Dado que existen pisos en diferentes tenants, cuando el administrador visualiza la lista de pisos, entonces solo se muestran los pisos pertenecientes al mismo tenant y no a otros.

---

## 8. Fuera de alcance

- La eliminación de Pisos (solo soft delete si está contemplado).
- La eliminación de Sectores (solo soft delete si está contemplado).
- La gestión de permisos a nivel de Piso o Sector.
- La visualización de Sectores fuera del contexto de su Piso.
- La visualización de Pisos fuera del contexto de su Tenant.

---

## 9. Impacto multi-tenant

- Las tablas de base de datos para Pisos y Sectores incluirán `tenant_id` y se aplicará Row Level Security (RLS) para asegurar el aislamiento entre inquilinos.
- Cada tabla seguirá la convención: `tenant_id TEXT NOT NULL` + índice `(tenant_id, id)` + `enable_tenant_isolation()`.
- Se requerirá un test específico para verificar que un `tenant_id` no puede acceder ni ver datos de Pisos/Sectores pertenecientes a otro `tenant_id`.
- El tenant se resuelve del claim `tenant` del JWT, no de un header o parámetro.

---

## 10. Requerimientos relacionados

- RFxx, RNFxx de `docs/roadmap/use_cases.md` (especificar si hay algún requerimiento funcional o no funcional directamente relacionado).
