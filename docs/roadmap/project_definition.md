# MapIt — Documento de Definición del Proyecto

### Taller de Sistemas de Información

> **Alineado con `use_cases.md` el 2026-08-23.**
> El alcance de este documento se amplió al pasar el equipo de 2-3 a **5 integrantes**:
> multi-tenant, vista pública de reservas, pagos QR y 4 verticales entraron en alcance real.
> Ante cualquier duda de alcance, **prevalece [`use_cases.md`](use_cases.md)**.

---

## 1. Contexto y motivación

Los negocios que operan sobre un espacio físico (restaurantes, discotecas, salones de eventos, hoteles, clínicas, talleres, coworkings, etc.) suelen gestionar ese espacio con herramientas que **no representan visualmente el lugar real**: hojas de cálculo, WhatsApp, pizarras, o sistemas de reservas que solo muestran listas y formularios.

Existen productos internacionales que sí resuelven esto (SevenRooms, TablelistPro, OpenTable, Sentaste — este último ya orientado a LATAM), pero en el mercado local (Bolivia) predominan soluciones de POS/facturación para restaurantes, sin un editor visual de espacios propio ni una capa de operación en tiempo real conectada a ese mapa.

**MapIt** nace de esa investigación: en vez de construir "otro sistema de reservas", se propone un motor que convierte el espacio físico de un negocio en una **interfaz operativa visual e interactiva**, donde el mapa no es un dibujo estático sino una vista en vivo de entidades reales (mesas, sectores, personas, reservas, eventos).

---

## 2. Nombre del proyecto

**MapIt**

> "Mapea tu negocio, opéralo en tiempo real."

El nombre comunica la idea central sin atarse a una sola industria (a diferencia de nombres como "TablelistPro" o "RestaurantOS"), lo cual es coherente con la decisión de construir un motor genérico por debajo de una demo enfocada.

---

## 3. Visión del producto

> Convertir el espacio físico de un negocio en un mapa digital interactivo, donde cada mesa, sector o elemento del espacio esté conectado a personas, reservas y eventos, y su estado se actualice en tiempo real para todos los usuarios conectados.

MapIt no se posiciona como un CRM tradicional (tablas y formularios) ni como un simple "editor de planos". Se posiciona como un **motor de gestión espacial**: el mapa es la interfaz principal de operación del negocio, no una funcionalidad secundaria.

---

## 4. Alcance del proyecto

### 4.1 Alcance académico (lo que se construye y sustenta en el semestre)

- **Arquitectura genérica** a nivel de modelo de datos y backend: cualquier tipo de espacio se modela con las mismas entidades base (`Establishment`, `Floor`, `Sector`, `SpaceElement`), sin necesidad de reescribir el motor para cada industria.
- **Multi-tenant real**: varias empresas conviven en la plataforma con datos aislados (CU-01 a CU-03). El aislamiento se implementa con columna discriminadora + Row-Level Security de PostgreSQL — ver [ADR-0004](../architecture/adr/ADR-0004-multi-tenant.md).
- **Demo funcional concreta en cuatro verticales**: Restaurante, Discoteca, **Salón de eventos** (butacas/ubicaciones numeradas) y **Hotel** (habitaciones como `SpaceElement`, reserva por rango de fechas), usando el mismo motor con distintas plantillas de elementos.
- **Vista pública de reservas**: el cliente final consulta disponibilidad y reserva sin credenciales de staff (CU-15, CU-16, CU-18).
- **Pago de anticipo con pasarela QR local** (CU-17), con confirmación por webhook.
- **Editor de mapas**, integrado en Angular. El motor de renderizado está **pendiente de decisión** (Konva.js propio vs. una herramienta que facilite la construcción); vive detrás de un puerto para que la elección no condicione el resto — ver [ADR-0006](../architecture/adr/ADR-0006-motor-de-mapa.md).
- **Actualización en tiempo real** de estados (mesa libre/ocupada/reservada) vía WebSocket (STOMP sobre Spring Boot), visible para todos los clientes conectados sin refrescar la página.
- **Gestión de personas** (clientes) asociadas a reservas y a su ubicación actual en el mapa.
- **Sistema de reservas** básico, con flujo de estados (reservada → activa → liberada).
- **Roles y permisos**: Super Admin de plataforma, Administrador de empresa, Manager/Encargado, Staff/Operador y Cliente final.
- **Dashboard** con métricas básicas de ocupación en tiempo real.
- **Feature toggles** para activar y desactivar funcionalidad sin redesplegar (ver §10 y [ADR-0005](../architecture/adr/ADR-0005-feature-toggles.md)).

### 4.2 Fuera de alcance (documentado como trabajo futuro, no se implementa)

- Facturación y POS. _(El pago de anticipo por QR sí entra en alcance; la facturación no.)_
- Aplicación móvil nativa. _(La web es responsive y se usa en tablet — RNF07.)_
- Computer Vision / detección automática de ocupación por cámaras.
- Analítica predictiva / IA.
- Marketplace de plantillas de elementos creadas por usuarios.
- Industrias más allá de las 4 definidas (Clínica, Coworking y Taller quedan como "plantillas conceptuales" en el marco teórico, sin implementación).
- Despliegue en la nube. _(Todo corre en localhost; se valida que el sistema funcione contenerizado con Docker para que el despliegue no sea un salto al vacío.)_

---

## 5. Objetivos

### 5.1 Objetivo general

Diseñar e implementar un sistema web (MapIt) que permita a un negocio modelar visualmente su espacio físico y operar sobre ese mapa en tiempo real, integrando gestión de reservas, clientes y estado de los elementos del espacio, usando Angular y Spring Boot.

### 5.2 Objetivos específicos

1. Diseñar un modelo de datos genérico capaz de representar espacios físicos de distintos tipos de negocio (`Establishment > Floor > Sector > SpaceElement`).
2. Implementar un editor visual de mapas (drag & drop, redimensionar, rotar, agrupar) usando Konva.js sobre Angular.
3. Implementar comunicación en tiempo real (WebSocket/STOMP) para reflejar cambios de estado de los elementos del mapa en todos los clientes conectados.
4. Implementar un módulo de gestión de personas y reservas, asociado a elementos del mapa (mesas/sectores).
5. Implementar autenticación y autorización basada en roles (Spring Security + JWT).
6. Construir un dashboard operativo con indicadores en tiempo real (ocupación, reservas activas, personas dentro).
7. Validar el modelo genérico mediante dos casos de uso concretos: Restaurante y Discoteca.
8. Documentar el registro histórico de eventos por elemento (bitácora de estados) como base para reportes.

---

## 6. Justificación

- **Técnica**: el proyecto exige combinar frontend interactivo avanzado (canvas, drag & drop, tiempo real), backend robusto (modelado de dominio, seguridad, WebSockets) y diseño de base de datos no trivial (jerarquías de espacio + histórico de eventos) — cubre en profundidad el ciclo de un sistema de información completo.
- **De negocio**: responde a una necesidad real y validada por productos existentes en el mercado internacional (SevenRooms, TablelistPro, Sentaste), pero con una oportunidad clara de diferenciación en el mercado local, donde no se identificó una solución boliviana equivalente.
- **Académica**: permite demostrar arquitectura extensible (un mismo motor sirviendo a dos industrias distintas), en lugar de un CRUD de un solo dominio.

---

## 7. Usuarios y roles del sistema

| Rol                            | Descripción                                       | Permisos principales                                                                   |
| ------------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Super Admin (plataforma)**   | Administra la plataforma multi-tenant             | Crear/suspender empresas (tenants), ver métricas globales                              |
| **Administrador (de empresa)** | Gestiona uno o más establecimientos de su empresa | Crear/editar pisos, sectores, elementos; gestionar usuarios de su tenant; ver reportes |
| **Manager / Encargado**        | Responsable de la operación diaria                | Editar mapa, gestionar reservas, ver dashboard, configurar precios y anticipos         |
| **Staff / Operador**           | Opera el mapa en tiempo real (recepción, mesero)  | Cambiar estado de elementos, recibir/liberar mesas, registrar clientes                 |
| **Cliente final**              | Usuario público, sin login de staff               | Consultar disponibilidad, crear reserva, pagar anticipo por QR, ver su historial       |

---

## 8. Modelo conceptual (alto nivel)

```
Establishment
   │
   ├── Floor (piso)
   │      │
   │      └── Sector
   │             │
   │             └── SpaceElement (mesa, barra, zona VIP, pista, etc.)
   │
   ├── Person (cliente)
   │
   ├── Reservation
   │
   └── Event (histórico de cambios de estado)
```

`SpaceElement` es la entidad clave de la genericidad: un mismo tipo base (`TABLE`, `BAR`, `SECTOR_ZONE`, `STAGE`, etc.) permite representar tanto una mesa de restaurante como una zona VIP de discoteca, cada una con sus propios atributos configurables (capacidad, reservable, color, ícono).

---

## 9. Requerimientos funcionales

| Código | Requerimiento                                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF01   | El sistema debe permitir crear un establecimiento y definir su tipo (restaurante, discoteca).                                                        |
| RF02   | El sistema debe permitir crear uno o más pisos por establecimiento.                                                                                  |
| RF03   | El sistema debe permitir crear sectores dentro de un piso.                                                                                           |
| RF04   | El sistema debe permitir un editor visual donde se agreguen, muevan, rotan y redimensionen elementos del espacio (mesas, barras, zonas).             |
| RF05   | El sistema debe persistir el mapa como una estructura de datos (JSON/entidades), no como imagen.                                                     |
| RF06   | El sistema debe permitir asignar un estado a cada elemento (disponible, ocupado, reservado, en limpieza, fuera de servicio).                         |
| RF07   | El sistema debe reflejar cambios de estado en tiempo real a todos los clientes conectados vía WebSocket.                                             |
| RF08   | El sistema debe permitir registrar clientes (personas) con datos básicos.                                                                            |
| RF09   | El sistema debe permitir crear reservas asociadas a un cliente y a un elemento del mapa.                                                             |
| RF10   | El sistema debe permitir el flujo de una reserva: creada → confirmada → activa (cliente recibido) → liberada/cancelada.                              |
| RF11   | El sistema debe registrar un histórico de eventos por elemento (bitácora: quién, qué, cuándo).                                                       |
| RF12   | El sistema debe mostrar un dashboard con ocupación actual, reservas activas y personas dentro del establecimiento.                                   |
| RF13   | El sistema debe implementar autenticación de usuarios.                                                                                               |
| RF14   | El sistema debe restringir funcionalidades según el rol del usuario autenticado.                                                                     |
| RF15   | El sistema debe permitir definir plantillas de tipo de elemento distintas según el tipo de establecimiento (ej. "Zona VIP" solo aplica a discoteca). |
| RF16   | El sistema debe permitir registrar empresas (tenants) y gestionar su ciclo de vida (activar/suspender).                                              |
| RF17   | El sistema debe aislar los datos entre tenants: un usuario de la Empresa A no puede acceder a datos de la Empresa B por ningún medio.                |
| RF18   | El sistema debe ofrecer una vista pública donde un cliente final consulte disponibilidad sin credenciales de staff.                                  |
| RF19   | El sistema debe permitir a un cliente final crear una reserva desde la vista pública.                                                                |
| RF20   | El sistema debe permitir pagar un anticipo mediante pasarela QR y confirmar la reserva al recibir la notificación de pago.                           |
| RF21   | El sistema debe permitir a un cliente final consultar su historial de reservas.                                                                      |
| RF22   | El sistema debe soportar reservas por rango de fechas (hotel), además de por turno o evento.                                                         |
| RF23   | El sistema debe soportar ubicaciones numeradas para salones de eventos (butacas, secciones).                                                         |
| RF24   | El sistema debe permitir activar y desactivar funcionalidades en tiempo de ejecución mediante feature toggles, sin necesidad de redesplegar.         |

### 9.1 Trazabilidad requerimiento ↔ caso de uso

| Requerimiento                   | Casos de uso                 |
| ------------------------------- | ---------------------------- |
| RF16, RF17                      | CU-01, CU-02, CU-03          |
| RF01, RF15                      | CU-04, CU-07                 |
| RF02, RF03                      | CU-05                        |
| RF04, RF05                      | CU-06, CU-08                 |
| RF06, RF07                      | CU-09                        |
| RF12                            | CU-10                        |
| RF08                            | CU-11                        |
| RF09, RF22, RF23                | CU-12                        |
| RF10                            | CU-13                        |
| RF11                            | CU-14                        |
| RF18                            | CU-15                        |
| RF19                            | CU-16                        |
| RF20                            | CU-17                        |
| RF21                            | CU-18                        |
| (validación del motor genérico) | CU-19, CU-20, CU-21, CU-22   |
| RF13                            | CU-23                        |
| RF14, RF17                      | CU-24                        |
| RF24                            | transversal (ver §10, RNF10) |

---

## 10. Requerimientos no funcionales

| Código | Requerimiento                                                                                                                                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RNF01  | El frontend debe desarrollarse en Angular.                                                                                                                                                                                                                         |
| RNF02  | El backend debe desarrollarse en Spring Boot.                                                                                                                                                                                                                      |
| RNF03  | La comunicación en tiempo real debe implementarse con WebSocket + STOMP.                                                                                                                                                                                           |
| RNF04  | La actualización de estado de un elemento debe reflejarse en los clientes conectados en menos de 2 segundos.                                                                                                                                                       |
| RNF05  | El sistema debe usar una base de datos relacional (PostgreSQL recomendado) para garantizar integridad en reservas y jerarquías espaciales.                                                                                                                         |
| RNF06  | El editor de mapas debe soportar al menos 50 elementos por piso sin degradar la experiencia de uso.                                                                                                                                                                |
| RNF07  | El sistema debe ser responsive (uso desde tablet, pensando en el "modo operación" en recepción).                                                                                                                                                                   |
| RNF08  | El código debe seguir una arquitectura en capas (controller-service-repository en backend; feature modules en Angular).                                                                                                                                            |
| RNF09  | Las contraseñas deben almacenarse cifradas (BCrypt) y la sesión debe gestionarse con JWT.                                                                                                                                                                          |
| RNF10  | El sistema debe permitir activar y desactivar funcionalidades en runtime mediante feature toggles, con estrategias por tenant, usuario o país, y sin redesplegar. Si el servidor de flags no responde, la aplicación debe seguir operando con valores por defecto. |
| RNF11  | El aislamiento entre tenants debe aplicarse en dos capas: en la aplicación (ORM) y en la base de datos (Row-Level Security), de modo que una consulta sin tenant en contexto no devuelva datos.                                                                    |
| RNF12  | El repositorio debe poder inicializarse en Windows, macOS y Linux con los mismos comandos, sin pasos manuales específicos del sistema operativo.                                                                                                                   |
| RNF13  | El contrato de la API debe estar especificado en OpenAPI y ser la fuente de verdad: el cliente del frontend y las interfaces del backend se generan a partir de él.                                                                                                |

---

## 11. Alcance tecnológico

| Capa                      | Tecnología                                                                                                                                                  | Versión |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Frontend                  | Angular (zoneless, signals, standalone)                                                                                                                     | 22      |
| Motor del editor de mapas | **Pendiente de decisión** (Konva.js propio vs. herramienta externa) — aislado tras un puerto, ver [ADR-0006](../architecture/adr/ADR-0006-motor-de-mapa.md) | —       |
| Backend                   | Spring Boot (REST API + WebSocket/STOMP)                                                                                                                    | 4.1.1   |
| Lenguaje backend          | Java (Temurin)                                                                                                                                              | 25 LTS  |
| Build backend             | Gradle multi-módulo (Kotlin DSL)                                                                                                                            | 9.2     |
| Seguridad                 | Spring Security + JWT (BCrypt)                                                                                                                              | —       |
| Base de datos             | PostgreSQL                                                                                                                                                  | 17      |
| Migraciones               | Flyway                                                                                                                                                      | 11      |
| Tiempo real               | WebSocket + STOMP (Spring) / RxJS (Angular)                                                                                                                 | —       |
| Feature toggles           | Unleash self-hosted                                                                                                                                         | 6       |
| Contrato de API           | OpenAPI 3.1 (spec-first) + springdoc                                                                                                                        | —       |
| Monorepo                  | pnpm workspaces + Angular CLI multi-proyecto                                                                                                                | —       |
| Contenedores              | Docker Compose                                                                                                                                              | —       |
| Testing                   | JUnit 5, Testcontainers, ArchUnit, Vitest, Playwright                                                                                                       | —       |

**Nota sobre el editor de mapas** _(revisada)_: la intención inicial fue construir el editor con Konva.js, descartando proveedores externos (Seats.io, Sentaste, SeatLayer) porque el objetivo académico del Taller es demostrar capacidad de diseño y construcción propia.

Al ampliarse el alcance a 5 integrantes —multi-tenant, reservas públicas, pagos y 4 verticales—, el equipo se planteó si construir el editor desde cero es sostenible en el tiempo del semestre. **La decisión queda abierta** y se toma al llegar a la Fase 3.

Para que esa duda no bloquee ni condicione el resto del sistema, el motor de renderizado vive detrás de un puerto (`MapEnginePort`) y el modelo del mapa es propio: cambiar de motor no afecta al backend, a la base de datos ni al contrato de la API. Si se optase por un proveedor externo, es condición indispensable que permita **persistir el mapa en nuestra base de datos** (RF05/CU-08). Ver [ADR-0006](../architecture/adr/ADR-0006-motor-de-mapa.md).

---

## 11.bis Metodología de desarrollo: Spec-Driven Development

El equipo desarrolla con **Spec-Driven Development (SDD)** apoyado en agentes de IA. Esto no
es un detalle de herramientas: cambia dónde está el trabajo intelectual del proyecto.

En un flujo tradicional el entregable valioso es el código, y la documentación lo describe
a posteriori. En SDD se invierte: el entregable valioso es la **especificación** —criterios
de aceptación, reglas de negocio, patrones de diseño justificados— y el código es su
consecuencia.

### Cómo se aplica

Cada caso de uso (CU-01 a CU-24) tiene un directorio en `specs/` con tres documentos que se
completan **en ese orden**:

| Documento  | Responde                                                                                    | Se escribe antes de           |
| ---------- | ------------------------------------------------------------------------------------------- | ----------------------------- |
| `spec.md`  | QUÉ y POR QUÉ: criterios de aceptación verificables, reglas de negocio, fuera de alcance    | pensar en la solución técnica |
| `plan.md`  | CÓMO: módulos afectados, cambios de contrato, migraciones, **patrones de diseño aplicados** | escribir código               |
| `tasks.md` | tareas ejecutables y verificables, en orden, con notas de ejecución                         | empezar a implementar         |

La sección _Patrones de diseño aplicados_ de `plan.md` es **obligatoria** e incluye, para
cada patrón, por qué encaja en ese caso concreto y qué alternativa se descartó.

### Por qué las barreras automáticas son más importantes, no menos

Si buena parte del código lo produce un agente, el review humano no puede ser la única
defensa: es donde antes se pierde la atención. Por eso la arquitectura se hace cumplir con
herramientas, no con disciplina:

| Garantía                                         | Quién la impone                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| El dominio no depende de frameworks              | el compilador — los módulos `*-domain` no declaran Spring                   |
| Las capas no se saltan                           | ArchUnit                                                                    |
| Las features del frontend no se acoplan entre sí | ESLint                                                                      |
| El esquema solo cambia por migración versionada  | Hibernate en modo `validate` rompe el arranque si divergen                  |
| El contrato de la API y el código no divergen    | el build de Java falla si el controlador no implementa la interfaz generada |
| Los datos de un tenant no se filtran a otro      | Row-Level Security de PostgreSQL                                            |

### Riesgo asumido y su contramedida

El riesgo real del desarrollo agéntico es evidente: **si el equipo no entiende lo que el
agente produjo, no puede defenderlo**. La contramedida es organizativa, no técnica: cada
integrante es dueño de sus casos de uso y debe poder explicar su `spec.md` y su `plan.md`
sin ayuda. Las _notas de ejecución_ de `tasks.md` documentan lo aprendido durante la
implementación y son parte del material de defensa.

Ver [ADR-0007](../architecture/adr/ADR-0007-spec-driven-development.md).

---

## 11.ter Feature toggles

El sistema incorpora **feature toggles**: condicionales cuyo valor se decide en tiempo de
ejecución, fuera del código, permitiendo activar o desactivar funcionalidad **sin recompilar
ni redesplegar**. Desacoplan el _despliegue_ del _lanzamiento_: el código puede estar
desplegado y apagado.

Se usan los cuatro tipos canónicos:

| Tipo            | Vida                | Ejemplo en MapIt                                           |
| --------------- | ------------------- | ---------------------------------------------------------- |
| **Release**     | temporal, se retira | `payments.qr` mientras se integra la pasarela              |
| **Kill switch** | permanente          | `realtime.websocket` — si STOMP satura, se cae a sondeo    |
| **Experiment**  | corta               | dos variantes de UX del editor                             |
| **Permission**  | permanente          | `vertical.hotel`, habilitada solo para tenants de ese tipo |

Un ejemplo del caso de uso operativo: si una funcionalidad falla solo en cierta región, se
desactiva **únicamente ahí** con una restricción por país mientras se depura, sin revertir
el despliegue completo ni afectar al resto de usuarios.

Implementación: **Unleash self-hosted**, consumido desde el backend a través de un puerto
(`FeatureFlagPort`) para no acoplar el dominio al proveedor, y desde el frontend a través de
un proxy que nunca expone el catálogo completo al navegador. Si el servidor de flags no
responde, la aplicación sigue operando con valores por defecto (RNF10).

Ver [ADR-0005](../architecture/adr/ADR-0005-feature-toggles.md).

---

## 12. Diferenciación (frente a lo investigado)

| Producto de referencia | Enfoque                                          | MapIt                                                                       |
| ---------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| SevenRooms             | CRM de huéspedes + reservas (hospitality)        | Motor espacial genérico, no atado a hospitality                             |
| TablelistPro           | Nightlife, mesas VIP                             | Motor genérico validado con 2 industrias                                    |
| OpenTable              | Reservas de restaurante                          | El mapa es la interfaz operativa central, no solo un plano estático         |
| Sentaste               | Editor de asientos + widget embebible para LATAM | Editor propio + capa de operación/CRM contextual, no solo venta de entradas |

La propuesta de valor de MapIt no es "tener más funciones", sino que **el mapa deja de ser un dibujo y se convierte en la interfaz de datos en vivo del negocio**.

---

## 13. Plan de fases (semestre, ~4-5 meses)

| Fase                                        | Contenido                                                                                            | Entregable                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Fase 0 — Setup e infraestructura**        | Monorepo, workspace, Docker, contrato API, feature toggles, CI, andamiaje de Spec-Driven Development | Repositorio inicializable con `pnpm setup && pnpm dev` en Windows, macOS y Linux |
| **Fase 1 — Análisis y diseño**              | Definición de requerimientos (este documento), modelo de datos, diagramas UML, prototipo de UI       | Documento de análisis, diagrama ER, mockups                                      |
| **Fase 2 — Backend base**                   | Modelo de entidades, autenticación JWT, CRUD de Establishment/Floor/Sector/SpaceElement              | API REST funcional documentada en Swagger                                        |
| **Fase 3 — Editor de mapas**                | Canvas en Angular con Konva.js: crear, mover, rotar, guardar elementos                               | Editor funcional conectado al backend                                            |
| **Fase 4 — Tiempo real y operación**        | WebSocket/STOMP, cambio de estado en vivo, flujo de reservas                                         | Mapa operando en tiempo real con al menos 2 clientes simultáneos                 |
| **Fase 5 — Personas, reservas e histórico** | Módulo de clientes, reservas, bitácora de eventos                                                    | Flujo completo reserva → ocupación → liberación                                  |
| **Fase 6 — Dashboard y roles**              | Indicadores en tiempo real, permisos por rol                                                         | Dashboard funcional + control de acceso                                          |
| **Fase 7 — Validación con 4 verticales**    | Configurar Restaurante, Discoteca, Salón de eventos y Hotel sobre el mismo motor                     | Demo con los cuatro casos de uso                                                 |
| **Fase 8 — Cierre**                         | Pruebas, documentación final, presentación                                                           | Sistema desplegado + documentación + defensa                                     |

_(Este cronograma es una propuesta inicial; se debe ajustar contra las fechas específicas de entregas parciales que defina el docente.)_

---

## 14. Distribución del equipo (5 personas)

Modelo elegido: **Backend/Frontend split + 1 flotante**.

| Integrante                           | Rol                                                                       | Casos de uso principales          |
| ------------------------------------ | ------------------------------------------------------------------------- | --------------------------------- |
| **A — Backend Core**                 | Modelo de datos, multi-tenant, entidades base                             | CU-01 a CU-08                     |
| **B — Backend Reservas/Pagos**       | Reservas, personas, pasarela QR, WebSocket                                | CU-09, CU-11 a CU-18              |
| **C — Frontend Editor**              | Angular, editor de mapas                                                  | CU-06, CU-07, CU-08               |
| **D — Frontend Operación/Dashboard** | Operación en tiempo real, dashboard, vista pública                        | CU-09, CU-10, CU-15, CU-16, CU-18 |
| **E — Full-stack / QA / Verticales** | Seguridad y roles, validación de las 4 verticales, pruebas de integración | CU-19 a CU-24                     |

_(Reemplaza la distribución de 2-3 personas del planteamiento original.)_

---

## 15. Trabajo futuro (visión, no se implementa en el semestre)

- Nuevas plantillas de industria: clínica, coworking, taller.
- Facturación y POS _(el pago de anticipo por QR sí se implementa)_.
- App móvil nativa para "modo operación".
- Analítica avanzada e IA (predicción de ocupación, clientes frecuentes).
- Integración con Computer Vision para detección automática de ocupación.
- Despliegue en la nube y escalado horizontal.

_(Multi-tenant, vista pública de reservas y pagos QR salieron de esta lista al ampliarse el equipo a 5 personas: ahora son alcance real.)_

---

## 16. Fuentes / trabajo relacionado consultado

- SevenRooms (CRM de hospitality + floor plans)
- TablelistPro (nightlife, mesas VIP)
- OpenTable, QuickSeat (reservas de restaurante)
- Seats.io, SeatLayer, Locatrix, Archilogic (SDKs de mapas interactivos embebibles)
- Sentaste, Grabspot (editor + widget orientado a LATAM)
- Attio, Pipedrive, Monday CRM, Airtable Interfaces, Miro (referencias de interfaces visuales/espaciales de CRM)
- Konva.js, Fabric.js, PixiJS (motores de canvas evaluados para el editor propio)
