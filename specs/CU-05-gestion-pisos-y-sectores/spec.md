# CU-05 — Gestión de Pisos y Sectores

> **Estado:** Borrador · **Creada:** 2026-09-12 · **Responsable:**

## Enunciado

Este caso de uso describe la funcionalidad para la creación y listado de Sectores dentro de un Piso existente en el sistema MapIt. Los sectores permitirán una gestión espacial más granular dentro de las áreas definidas por los pisos.

---

## 1. Por qué (contexto)

Actualmente, la gestión espacial se limita a Pisos. Para operaciones más detalladas, como la asignación de mesas en un restaurante, la definición de zonas de baile en una discoteca o la organización de áreas en un hotel, es necesario poder dividir los pisos en secciones más pequeñas y manejables. La entidad Sector permitirá esta granularidad, mejorando la operatividad y la visualización del espacio.

## 2. Actores

| Rol           | Qué hace en este caso de uso                                                                                            |
| :------------ | :---------------------------------------------------------------------------------------------------------------------- |
| Administrador | Puede crear nuevos Sectores, asociarlos a un Piso específico y visualizar la lista de Sectores existentes para un Piso. |

## 3. Precondiciones

- El administrador debe estar autenticado en el sistema.
- El administrador debe tener los permisos necesarios para gestionar la configuración espacial (Pisos y Sectores).
- Debe existir un Piso al cual asociar el nuevo Sector.

## 4. Flujo principal

1.  El administrador accede a la sección de gestión de configuración espacial.
2.  El administrador selecciona un Piso existente para el cual desea gestionar sus Sectores.
3.  El sistema muestra la lista actual de Sectores asociados a ese Piso (si los hay).
4.  El administrador inicia la acción para crear un nuevo Sector, proporcionando únicamente el nombre para el Sector (ej. "Terraza Norte").
5.  El sistema (frontend) autogenera el slug de forma transparente a partir del nombre ingresado (ej. convirtiendo "Terraza Norte" a "terraza-norte").
6.  El sistema valida la información ingresada (incluyendo la unicidad del slug generado) según las reglas de negocio.
7.  Si la validación es exitosa, el sistema crea el nuevo Sector y lo asocia al Piso seleccionado.
8.  El sistema actualiza y muestra la lista de Sectores para el Piso seleccionado, incluyendo el nuevo Sector.
9.  Si la validación es exitosa, el sistema crea el nuevo Sector y lo asocia al Piso seleccionado.
10. El sistema actualiza y muestra la lista de Sectores para el Piso seleccionado, incluyendo el nuevo Sector.

## 5. Flujos alternativos y errores

| Situación                                                                                                            | Comportamiento esperado                                                                                        |
| :------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| El nombre del Sector excede los 100 caracteres.                                                                      | El sistema muestra un mensaje de error indicando la restricción de longitud del nombre y el Sector no se crea. |
| El slug del Sector ya existe para el mismo `floor_id`.                                                               | El sistema muestra un mensaje de error indicando que el slug ya existe para ese Piso y el Sector no se crea.   |
| El `floor_id` seleccionado no existe en el sistema.                                                                  | El sistema muestra un mensaje de error indicando que el Piso no fue encontrado y el Sector no se crea.         |
| El administrador intenta crear un Sector sin los permisos adecuados.                                                 | El sistema muestra un mensaje de error de "Acceso denegado" y la operación no se completa.                     |
| El slug del Sector contiene caracteres no permitidos o tiene un formato inválido (si se definen reglas adicionales). | El sistema muestra un mensaje de error indicando el formato inválido del slug y el Sector no se crea.          |

## 6. Reglas de negocio

- **RN-1:** El Sector debe pertenecer a un `tenant_id` específico.
- **RN-2:** El Sector debe estar asociado a un `floor_id` específico.
- **RN-3:** El nombre del Sector no debe exceder los 100 caracteres.
- **RN-4:** El slug del Sector debe ser único dentro del mismo `floor_id`.

## 7. Criterios de aceptación

- [ ] **CA-1:** Dado que un administrador está en la sección de gestión de pisos y ha seleccionado un piso existente, cuando crea un nuevo sector proporcionando un nombre válido (ej. "Zona VIP"), el sistema genera automáticamente el slug ("zona-vip") y el sector se crea exitosamente, mostrándose en la lista.
- [ ] **CA-2:** Dado que un administrador está en la sección de gestión de pisos, cuando intenta crear un nuevo sector con un nombre que excede los 100 caracteres, entonces el sistema muestra un mensaje de error indicando la restricción de longitud del nombre y no se crea el sector.
- [ ] **CA-3:** Dado que ya existe un sector con el slug "zona-vip" en el piso seleccionado, cuando el sistema intenta generar automáticamente un slug para un nuevo sector (ej. nombre "Zona VIP") que resultaría en "zona-vip", entonces el sistema muestra un mensaje de error indicando que el slug ya existe para ese piso y no se crea el sector.
- [ ] **CA-4:** Dado que un administrador está intentando crear un sector, cuando selecciona un `floor_id` que no existe en el sistema, entonces el sistema muestra un mensaje de error indicando que el piso no fue encontrado y no se crea el sector.
- [ ] **CA-5:** Dado que se ha creado exitosamente un nuevo sector en un piso, cuando el administrador visualiza la lista de sectores para ese piso, entonces el nuevo sector aparece en la lista con su nombre y slug.
- [ ] **CA-6:** Dado que existen sectores en varios pisos diferentes, cuando el administrador visualiza la lista de sectores de un piso específico, entonces solo se muestran los sectores pertenecientes a ese piso y no a otros.

## 8. Fuera de alcance

- La edición de Sectores existentes.
- La eliminación de Sectores.
- La gestión de permisos a nivel de Sector.
- La visualización de Sectores fuera del contexto de su Piso.

## 9. Impacto multi-tenant

- Las tablas de base de datos para Sectores incluirán `tenant_id` y se aplicará Row Level Security (RLS) para asegurar el aislamiento entre inquilinos.
- Se requerirá un test específico para verificar que un `tenant_id` no puede acceder ni ver datos de Sectores pertenecientes a otro `tenant_id`.

## 10. Requerimientos relacionados

- RFxx, RNFxx de `docs/roadmap/use_cases.md` (especificar si hay algún requerimiento funcional o no funcional directamente relacionado).
