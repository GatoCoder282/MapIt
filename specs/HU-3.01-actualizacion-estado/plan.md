# Plan — HU-3.01 Actualización de Estado

## Arquitectura

La capacidad vive en `operations`, responsable de CU-09. `operations-domain` modela el
elemento operativo y declara el puerto de persistencia; `operations-application` ejecuta la
transacción; `operations-infrastructure` adapta PostgreSQL y REST. No se importa `spaces`:
ambos contextos comparten únicamente identificadores y `SpaceElementState` del shared kernel.

## Contrato

El contrato se incorpora primero en `packages/api-contract/openapi.yaml` con un PATCH
autenticado, request de estado y respuesta mínima del estado persistido.

## Persistencia

MAP-124 reutiliza `space_element.state` y `updated_at`. El adaptador fija
`SET LOCAL app.tenant_id` dentro de la transacción y restringe por `tenant_id`, `sector_id`,
`id` y `deleted_at IS NULL`.

MAP-125 añade la tabla de auditoría mediante una migración nueva. MAP-126 incorpora la
matriz completa mediante `SpaceElementStateMachine`, dentro del dominio puro.

## Patrones de diseño aplicados

| Patrón              | Aplicación                                                      | Por qué aquí                                                            | Alternativa descartada                                          |
| ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| Ports and Adapters  | Puerto de estado en dominio y adaptador JDBC en infraestructura | Mantiene el caso de uso independiente de PostgreSQL y del módulo spaces | Importar el repositorio JPA de spaces acoplaría módulos backend |
| Application Service | `UpdateSpaceElementState` delimita la transacción               | Coordina tenant, dominio y persistencia en un punto comprobable         | Poner la lógica en el controlador mezclaría HTTP y negocio      |
| Repository          | Acceso al estado operativo mediante una interfaz del dominio    | Permite probar el caso de uso sin base de datos                         | Ejecutar SQL desde application rompería la arquitectura         |
| State               | `SpaceElementStateMachine` concentra las transiciones válidas   | Hace explícito el ciclo operativo y evita reglas dispersas              | Condicionales en controlador y servicio duplicarían la política |

## Entregas por MAP

| MAP     | Entrega                                                           |
| ------- | ----------------------------------------------------------------- |
| MAP-124 | Contrato PATCH, caso de uso, persistencia, autorización y errores |
| MAP-125 | Auditoría persistente del cambio                                  |
| MAP-126 | Máquina de estados y rechazo de transiciones inválidas            |
| MAP-127 | Acción visual para Staff                                          |
| MAP-128 | Integración Angular con el cliente API y manejo de resultados     |
| MAP-144 | Integración, roles, tenant, auditoría y transiciones              |
