# MapIt — Documento de Definición del Proyecto
### Taller de Sistemas de Información

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
- **Demo funcional concreta en dos verticales**: Restaurante y Discoteca, usando el mismo motor con distintas plantillas de elementos (mesa, barra, zona VIP, pista de baile, etc.).
- **Editor de mapas propio**, construido con Konva.js integrado en Angular (no se usa un proveedor externo tipo Seats.io — se documenta como trabajo relacionado, no como dependencia).
- **Actualización en tiempo real** de estados (mesa libre/ocupada/reservada) vía WebSocket (STOMP sobre Spring Boot), visible para todos los clientes conectados sin refrescar la página.
- **Gestión de personas** (clientes) asociadas a reservas y a su ubicación actual en el mapa.
- **Sistema de reservas** básico, con flujo de estados (reservada → activa → liberada).
- **Roles y permisos** (mínimo: Administrador, Manager/Encargado de establecimiento, Staff/Operador).
- **Dashboard** con métricas básicas de ocupación en tiempo real.

### 4.2 Fuera de alcance (documentado como trabajo futuro, no se implementa)

- Multiempresa/multi-tenant completo (se documenta como diseño posible, no se construye a fondo).
- Facturación, POS, integración de pagos QR.
- Aplicación móvil nativa.
- Computer Vision / detección automática de ocupación por cámaras.
- Analítica predictiva / IA.
- Marketplace de plantillas de elementos creadas por usuarios.
- Otras industrias más allá de Restaurante y Discoteca (Hotel, Clínica, Eventos quedan como "plantillas conceptuales" mencionadas en el marco teórico, sin implementación).

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

| Rol | Descripción | Permisos principales |
|---|---|---|
| **Administrador** | Gestiona el establecimiento completo | Crear/editar pisos, sectores, elementos; gestionar usuarios; ver reportes |
| **Manager / Encargado** | Responsable de la operación diaria | Editar mapa, gestionar reservas, ver dashboard |
| **Staff / Operador** | Opera el mapa en tiempo real (recepción, mesero) | Cambiar estado de elementos, recibir/liberar mesas, registrar clientes |
| **Cliente final (opcional, fase 2)** | Podría reservar desde una vista pública | Crear reserva, consultar disponibilidad |

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

| Código | Requerimiento |
|---|---|
| RF01 | El sistema debe permitir crear un establecimiento y definir su tipo (restaurante, discoteca). |
| RF02 | El sistema debe permitir crear uno o más pisos por establecimiento. |
| RF03 | El sistema debe permitir crear sectores dentro de un piso. |
| RF04 | El sistema debe permitir un editor visual donde se agreguen, muevan, rotan y redimensionen elementos del espacio (mesas, barras, zonas). |
| RF05 | El sistema debe persistir el mapa como una estructura de datos (JSON/entidades), no como imagen. |
| RF06 | El sistema debe permitir asignar un estado a cada elemento (disponible, ocupado, reservado, en limpieza, fuera de servicio). |
| RF07 | El sistema debe reflejar cambios de estado en tiempo real a todos los clientes conectados vía WebSocket. |
| RF08 | El sistema debe permitir registrar clientes (personas) con datos básicos. |
| RF09 | El sistema debe permitir crear reservas asociadas a un cliente y a un elemento del mapa. |
| RF10 | El sistema debe permitir el flujo de una reserva: creada → confirmada → activa (cliente recibido) → liberada/cancelada. |
| RF11 | El sistema debe registrar un histórico de eventos por elemento (bitácora: quién, qué, cuándo). |
| RF12 | El sistema debe mostrar un dashboard con ocupación actual, reservas activas y personas dentro del establecimiento. |
| RF13 | El sistema debe implementar autenticación de usuarios. |
| RF14 | El sistema debe restringir funcionalidades según el rol del usuario autenticado. |
| RF15 | El sistema debe permitir definir plantillas de tipo de elemento distintas según el tipo de establecimiento (ej. "Zona VIP" solo aplica a discoteca). |

---

## 10. Requerimientos no funcionales

| Código | Requerimiento |
|---|---|
| RNF01 | El frontend debe desarrollarse en Angular. |
| RNF02 | El backend debe desarrollarse en Spring Boot. |
| RNF03 | La comunicación en tiempo real debe implementarse con WebSocket + STOMP. |
| RNF04 | La actualización de estado de un elemento debe reflejarse en los clientes conectados en menos de 2 segundos. |
| RNF05 | El sistema debe usar una base de datos relacional (PostgreSQL recomendado) para garantizar integridad en reservas y jerarquías espaciales. |
| RNF06 | El editor de mapas debe soportar al menos 50 elementos por piso sin degradar la experiencia de uso. |
| RNF07 | El sistema debe ser responsive (uso desde tablet, pensando en el "modo operación" en recepción). |
| RNF08 | El código debe seguir una arquitectura en capas (controller-service-repository en backend; feature modules en Angular). |
| RNF09 | Las contraseñas deben almacenarse cifradas (BCrypt) y la sesión debe gestionarse con JWT. |

---

## 11. Alcance tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Angular + Konva.js (motor de canvas para el editor de mapas) |
| Backend | Spring Boot (REST API + WebSocket/STOMP) |
| Seguridad | Spring Security + JWT |
| Base de datos | PostgreSQL |
| Tiempo real | WebSocket + STOMP (Spring) / RxJS o SockJS-client (Angular) |
| Documentación API | Swagger / OpenAPI |

**Nota sobre el editor de mapas**: se descartó usar un proveedor externo (Seats.io, Sentaste, SeatLayer) para el editor, ya que el objetivo académico del Taller es demostrar la capacidad de diseño y construcción propia del equipo. Estos productos se documentan como **trabajo relacionado** en el marco teórico, no como dependencia técnica.

---

## 12. Diferenciación (frente a lo investigado)

| Producto de referencia | Enfoque | MapIt |
|---|---|---|
| SevenRooms | CRM de huéspedes + reservas (hospitality) | Motor espacial genérico, no atado a hospitality |
| TablelistPro | Nightlife, mesas VIP | Motor genérico validado con 2 industrias |
| OpenTable | Reservas de restaurante | El mapa es la interfaz operativa central, no solo un plano estático |
| Sentaste | Editor de asientos + widget embebible para LATAM | Editor propio + capa de operación/CRM contextual, no solo venta de entradas |

La propuesta de valor de MapIt no es "tener más funciones", sino que **el mapa deja de ser un dibujo y se convierte en la interfaz de datos en vivo del negocio**.

---

## 13. Plan de fases (semestre, ~4-5 meses)

| Fase | Contenido | Entregable |
|---|---|---|
| **Fase 1 — Análisis y diseño** | Definición de requerimientos (este documento), modelo de datos, diagramas UML, prototipo de UI | Documento de análisis, diagrama ER, mockups |
| **Fase 2 — Backend base** | Modelo de entidades, autenticación JWT, CRUD de Establishment/Floor/Sector/SpaceElement | API REST funcional documentada en Swagger |
| **Fase 3 — Editor de mapas** | Canvas en Angular con Konva.js: crear, mover, rotar, guardar elementos | Editor funcional conectado al backend |
| **Fase 4 — Tiempo real y operación** | WebSocket/STOMP, cambio de estado en vivo, flujo de reservas | Mapa operando en tiempo real con al menos 2 clientes simultáneos |
| **Fase 5 — Personas, reservas e histórico** | Módulo de clientes, reservas, bitácora de eventos | Flujo completo reserva → ocupación → liberación |
| **Fase 6 — Dashboard y roles** | Indicadores en tiempo real, permisos por rol | Dashboard funcional + control de acceso |
| **Fase 7 — Validación con 2 verticales** | Configurar Restaurante y Discoteca sobre el mismo motor | Demo con ambos casos de uso |
| **Fase 8 — Cierre** | Pruebas, documentación final, presentación | Sistema desplegado + documentación + defensa |

*(Este cronograma es una propuesta inicial; se debe ajustar contra las fechas específicas de entregas parciales que defina el docente.)*

---

## 14. Distribución sugerida del equipo (2-3 personas)

| Rol | Responsabilidad principal |
|---|---|
| **Integrante A — Backend/Datos** | Modelo de entidades, API REST, seguridad JWT, WebSocket en Spring Boot |
| **Integrante B — Frontend/Editor** | Angular, integración con Konva.js, editor de mapas, consumo de API |
| **Integrante C — Operación/Full-stack** *(si son 3)* | Módulo de reservas, dashboard, tiempo real en frontend, pruebas de integración |

Si el equipo es de 2 personas, el rol C se reparte entre A y B por sprint.

---

## 15. Trabajo futuro (visión, no se implementa en el semestre)

- Multi-tenant real (varias empresas en la misma plataforma).
- Nuevas plantillas de industria: hotel, clínica, coworking, taller.
- Integración de pagos/QR y facturación.
- App móvil para "modo operación".
- Analítica avanzada e IA (predicción de ocupación, clientes frecuentes).
- Integración con Computer Vision para detección automática de ocupación.

---

## 16. Fuentes / trabajo relacionado consultado

- SevenRooms (CRM de hospitality + floor plans)
- TablelistPro (nightlife, mesas VIP)
- OpenTable, QuickSeat (reservas de restaurante)
- Seats.io, SeatLayer, Locatrix, Archilogic (SDKs de mapas interactivos embebibles)
- Sentaste, Grabspot (editor + widget orientado a LATAM)
- Attio, Pipedrive, Monday CRM, Airtable Interfaces, Miro (referencias de interfaces visuales/espaciales de CRM)
- Konva.js, Fabric.js, PixiJS (motores de canvas evaluados para el editor propio)