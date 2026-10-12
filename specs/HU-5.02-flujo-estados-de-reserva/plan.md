# HU-5.02 — Plan técnico

## 1. Enfoque

La máquina de estados vive en `reservations-domain`, y un caso de uso transaccional
coordina contexto autenticado, lectura tenant-scoped y actualización condicional del estado.
El adaptador JDBC realiza una actualización compare-and-set por estado actual para que dos
operaciones concurrentes no salten ni sobrescriban transiciones. OpenAPI define primero el
endpoint; la respuesta incluye los destinos permitidos calculados por el dominio para que la
consola presente acciones sin duplicar la política.

## 2. Patrones de diseño aplicados

| Patrón                          | Dónde                                           | Por qué aquí                                                                  | Alternativa descartada                                     |
| ------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| State                           | `ReservationStatus` y su matriz de transiciones | Centraliza el ciclo de vida y hace verificable cada transición                | Condicionales en controlador o consola duplicarían reglas  |
| Application Service             | Caso de uso `TransitionReservationStatus`       | Coordina autorización contextual, repositorio y transacción                   | Poner persistencia y reglas en el controlador mezcla capas |
| Repository / Ports and Adapters | Puerto de reserva en dominio y adaptador JDBC   | Conserva el dominio puro y mantiene los filtros tenant/RLS en infraestructura | Acceso JDBC desde application acoplaría el caso de uso     |

## 3. Cambios en el contrato API

- [x] Editar `packages/api-contract/openapi.yaml` antes de implementar y regenerar con `pnpm api:gen`.

| Método | Ruta                                                                    | Descripción                                                                |
| ------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| PATCH  | `/establishments/{establishmentId}/reservations/{reservationId}/status` | Solicita transición y devuelve reserva persistida con `allowedTransitions` |

## 4. Backend

**Módulo:** `reservations`

| Capa                          | Qué se añade                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reservations-domain`         | Matriz central, método inmutable de transición, excepción de transición inválida y métodos de lectura/actualización condicional en el puerto                  |
| `reservations-application`    | Caso de uso transaccional; tenant y actor desde contextos autenticados; errores diferenciados para no encontrado, transición inválida y conflicto concurrente |
| `reservations-infrastructure` | Búsqueda por tenant/establecimiento/id con RLS, `UPDATE ... WHERE status = estadoAnterior`, PATCH REST, Problem Details y autorización por rol                |

## 5. Base de datos

- No requiere migración: V17 ya incluye los cinco estados, `updated_at`, `updated_by`, índice y RLS.
- La actualización establece actor e instante, respetando el trigger `touch_updated_at`.
- No se crea tabla de auditoría; MAP-193 no lo solicita.

## 6. Frontend

**App:** `console` · **Feature:** `reservations`

| Parte    | Qué se añade                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------- |
| `data/`  | Llamada tipada al endpoint de transición generado desde OpenAPI                                   |
| `model/` | Comando de transición y estado de carga/error; reemplaza la reserva local solo con respuesta API  |
| `ui/`    | Etiqueta visual de estado y acciones renderizadas desde `allowedTransitions`; textos en `STRINGS` |

## 7. Feature toggle

- No requiere feature flag; es parte del ciclo principal de reservas.

## 8. Testing

| Nivel                         | Qué se prueba                                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Unit (dominio)                | Todas las transiciones permitidas, transiciones inválidas, idempotencia rechazada y estados terminales                      |
| Unit (application/controller) | Tenant/actor, not-found, `409` y traducción del request/response                                                            |
| Integración                   | Persistencia, tenant/establecimiento, autorización, RLS, no escritura en error y concurrencia con actualización condicional |
| Frontend                      | Acciones derivadas de API, estado actualizado solo al éxito y conservación del estado ante errores                          |

## 9. Riesgos

| Riesgo                                      | Mitigación                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| Dos operadores transicionan simultáneamente | Actualización compare-and-set; el segundo recibe `409`                 |
| Divergencia frontend/backend en acciones    | La API responde `allowedTransitions`; la consola no contiene la matriz |
| Fuga entre tenants                          | Filtro explícito y RLS, con pruebas de integración cruzadas            |
