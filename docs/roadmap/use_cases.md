# MapIt — Casos de Uso y Alcance Ampliado (Equipo de 5)

### Taller de Sistemas de Información

Este documento extiende `project_definition.md`. Con un equipo de 5 personas se amplía el alcance original (pensado para 2-3) en los siguientes puntos, definidos junto al equipo:

---

## 1. Cambios de alcance respecto al documento original

| Ítem (antes "fuera de alcance") | Decisión | Detalle |
|---|---|---|
| Multi-tenant | **Se sube a alcance real** | Varias empresas/establecimientos conviven en la misma plataforma, cada uno con sus propios pisos, sectores, usuarios y datos aislados. |
| Vista pública de reservas | **Se sube a alcance real** | El rol "Cliente final" deja de ser opcional/fase 2: se construye una vista pública (sin credenciales de staff) para consultar disponibilidad y reservar. |
| Pagos/QR | **Se sube a alcance real** | Integración con una pasarela de QR local (Bolivia) para anticipos/pagos de reserva, no solo un mock. |
| Verticales de industria | **Se amplía de 2 a 4** | Restaurante, Discoteca, **Salón de eventos** (teatro, filarmónica, conciertos — mesas y secciones tipo discoteca pero con venta de entradas/ubicaciones numeradas) y **Hotel** (habitaciones como `SpaceElement`, reservas por estadía en vez de por turno). |
| App móvil, Computer Vision, Analítica/IA, Marketplace de plantillas | **Se mantienen fuera de alcance** | Sin cambios; siguen como trabajo futuro. |

---

## 2. Roles del sistema (actualizado)

| Rol | Descripción | Alcance |
|---|---|---|
| **Super Admin (plataforma)** | Administra la plataforma multi-tenant | Crear/suspender empresas (tenants), ver métricas globales |
| **Administrador (de empresa)** | Gestiona uno o más establecimientos de su empresa | Crear pisos, sectores, elementos; gestionar usuarios de su tenant; ver reportes |
| **Manager / Encargado** | Responsable de la operación diaria de un establecimiento | Editar mapa, gestionar reservas, ver dashboard, configurar precios/anticipos |
| **Staff / Operador** | Opera el mapa en tiempo real (recepción, mesero) | Cambiar estado de elementos, recibir/liberar mesas, registrar clientes |
| **Cliente final** | Usuario público, sin login de staff | Consultar disponibilidad, crear reserva, pagar anticipo vía QR, ver su historial de reservas |

---

## 3. Casos de uso esenciales

### 3.1 Plataforma / Multi-tenant
- **CU-01** Registrar una nueva empresa (tenant) en la plataforma.
- **CU-02** Aislar datos entre tenants (un Admin de la Empresa A no ve establecimientos de la Empresa B).
- **CU-03** Super Admin gestiona el ciclo de vida de tenants (activar/suspender).

### 3.2 Gestión de espacio (motor genérico)
- **CU-04** Crear establecimiento y elegir su tipo (restaurante, discoteca, salón de eventos, hotel).
- **CU-05** Crear pisos y sectores dentro de un establecimiento.
- **CU-06** Editor visual: agregar, mover, rotar, redimensionar y agrupar `SpaceElement` (Konva.js).
- **CU-07** Definir plantillas de elemento según tipo de establecimiento (mesa, barra, zona VIP, butaca numerada, habitación).
- **CU-08** Persistir el mapa como estructura de datos (no imagen).

### 3.3 Operación en tiempo real
- **CU-09** Cambiar el estado de un elemento (libre/ocupado/reservado/limpieza/fuera de servicio) y reflejarlo vía WebSocket a todos los clientes conectados en <2s.
- **CU-10** Dashboard operativo con ocupación en vivo, reservas activas y personas dentro.

### 3.4 Personas y reservas
- **CU-11** Registrar clientes (personas) con datos básicos.
- **CU-12** Crear reserva asociada a un cliente y a uno o más `SpaceElement` (ej. varias mesas de un evento, o una habitación).
- **CU-13** Flujo de estado de reserva: creada → confirmada (con/sin anticipo) → activa → liberada/cancelada.
- **CU-14** Registrar histórico de eventos por elemento (bitácora: quién, qué, cuándo).

### 3.5 Reservas públicas y pagos
- **CU-15** Cliente final consulta disponibilidad en vista pública (sin login de staff), filtrando por establecimiento/fecha.
- **CU-16** Cliente final crea una reserva desde la vista pública.
- **CU-17** Cliente final paga un anticipo/entrada vía pasarela QR local; el sistema confirma la reserva al recibir el webhook/confirmación de pago.
- **CU-18** Cliente final consulta su historial de reservas.

### 3.6 Verticales validadas (mismo motor, 4 configuraciones)
- **CU-19** Configurar y operar un Restaurante (mesas, sectores, reservas por turno).
- **CU-20** Configurar y operar una Discoteca (mesas VIP, pista, zonas, reservas por evento/noche).
- **CU-21** Configurar y operar un Salón de eventos (butacas/mesas numeradas, secciones, venta de ubicaciones para conciertos/teatro/filarmónica).
- **CU-22** Configurar y operar un Hotel (habitaciones como `SpaceElement`, reservas por rango de fechas en vez de por turno/noche).

### 3.7 Seguridad y roles
- **CU-23** Autenticación de usuarios (staff) con JWT.
- **CU-24** Autorización por rol (Super Admin, Admin, Manager, Staff) y por tenant.

---

## 4. Distribución sugerida del equipo (5 personas)

Modelo elegido: **Backend/Frontend split + 1 flotante**.

| Integrante | Rol | Casos de uso principales |
|---|---|---|
| **A — Backend Core** | Modelo de datos, multi-tenant, entidades base | CU-01 a CU-08 |
| **B — Backend Reservas/Pagos** | Reservas, personas, integración pasarela QR, WebSocket | CU-09, CU-11 a CU-18 |
| **C — Frontend Editor** | Angular + Konva.js, editor de mapas | CU-06, CU-07, CU-08 |
| **D — Frontend Operación/Dashboard** | Vista de operación en tiempo real, dashboard, vista pública de reservas | CU-09, CU-10, CU-15, CU-16, CU-18 |
| **E — Full-stack / QA / Verticales** | Seguridad y roles, validación de las 4 verticales, pruebas de integración | CU-19 a CU-24 |

---

## 5. Fuera de alcance (sin cambios)

- Aplicación móvil nativa.
- Computer Vision / detección automática de ocupación por cámaras.
- Analítica predictiva / IA.
- Marketplace de plantillas de elementos creadas por usuarios.
- Industrias adicionales a las 4 definidas (Clínica, Coworking quedan como plantillas conceptuales, sin implementación).
