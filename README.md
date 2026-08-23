# MapIt

> **Mapea tu negocio, opéralo en tiempo real.**

Motor de gestión espacial multi-tenant: convierte el espacio físico de un negocio en un mapa
digital interactivo, donde cada mesa, sector o habitación está conectado a personas, reservas
y eventos, y su estado se actualiza en vivo para todos los usuarios conectados.

Proyecto de **Taller de Sistemas de Información**. Ver [`docs/roadmap/`](docs/roadmap/).

---

## Requisitos (instalar una sola vez)

| #   | Herramienta        | Versión  | Dónde                                                                              |
| --- | ------------------ | -------- | ---------------------------------------------------------------------------------- |
| 1   | **Node.js**        | 24 LTS   | [nodejs.org](https://nodejs.org)                                                   |
| 2   | **pnpm**           | 11+      | `corepack enable`                                                                  |
| 3   | **JDK Temurin**    | 25       | [adoptium.net](https://adoptium.net)                                               |
| 4   | **Docker Desktop** | reciente | [docker.com](https://www.docker.com/products/docker-desktop/) — WSL2 + 6 GB de RAM |

> **No instales Gradle ni Angular CLI.** Van incluidos en el repo (wrapper de Gradle y
> `pnpm exec ng`), así los 5 usamos exactamente la misma versión.

**Windows:** `winget install EclipseAdoptium.Temurin.25.JDK` y reabre la terminal.

---

## Arrancar

```bash
git clone https://github.com/GatoCoder282/MapIt.git
cd MapIt
pnpm install
pnpm setup     # ~5 min la primera vez: crea .env, levanta Docker, migra la BD
pnpm dev
```

¿Algo falta en tu máquina? `pnpm doctor` te dice **qué** y **con qué comando** arreglarlo.

## ¿Dónde queda cada cosa?

| Servicio                | URL                                               |
| ----------------------- | ------------------------------------------------- |
| Consola (staff)         | <http://localhost:4200>                           |
| Vista pública           | <http://localhost:4300>                           |
| API + Swagger           | <http://localhost:8080/swagger-ui.html>           |
| Feature flags (Unleash) | <http://localhost:4242> — `admin` / `unleash4all` |
| Correos de prueba       | <http://localhost:8025>                           |
| PostgreSQL              | `localhost:5433`                                  |

> El puerto de Postgres es **5433**, no 5432, para no chocar con un PostgreSQL
> instalado nativamente. Dentro de Docker el contenedor sigue en 5432.

---

## Los comandos que usarás a diario

```bash
pnpm dev          # todo: infra + backend + las 2 apps
pnpm dev:front    # solo las apps Angular
pnpm dev:back     # solo infra + Spring Boot
pnpm check        # ANTES DE CADA PUSH: lint + tipos + tests + build
pnpm stop         # baja los contenedores
```

`pnpm run` (sin argumentos) lista **todos** los comandos disponibles.

---

## Estructura

```
apps/
  backend/      Spring Boot 4.1 · Gradle multi-módulo · Hexagonal Modular
  console/      Angular 22 — staff: editor de mapas, operación, dashboard
  public-web/   Angular 22 — cliente final: disponibilidad, reserva, pago QR
  e2e/          Playwright
libs/           librerías Angular compartidas
packages/       contrato OpenAPI y configuración compartida
infra/docker/   compose de desarrollo y de despliegue
specs/          una carpeta por caso de uso (spec → plan → tasks)
docs/           roadmap, arquitectura (ADR), modelo de datos (DBML), diagramas
```

## Stack

| Capa          | Tecnología                                            |
| ------------- | ----------------------------------------------------- |
| Frontend      | Angular 22 (zoneless, signals), Vitest                |
| Backend       | Spring Boot 4.1.1, Java 25, Gradle (Kotlin DSL)       |
| Base de datos | PostgreSQL 17 + Flyway + Row-Level Security           |
| Tiempo real   | WebSocket + STOMP                                     |
| Feature flags | Unleash (self-hosted)                                 |
| Contrato      | OpenAPI 3.1 — spec-first                              |
| Testing       | JUnit 5, Testcontainers, ArchUnit, Vitest, Playwright |

---

## ¿Y ahora qué?

| Quiero…                           | Leer                                                     |
| --------------------------------- | -------------------------------------------------------- |
| …resolver un error al arrancar    | [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md)               |
| …empezar a desarrollar            | [`CONTRIBUTING.md`](CONTRIBUTING.md)                     |
| …entender el alcance del proyecto | [`docs/roadmap/use_cases.md`](docs/roadmap/use_cases.md) |
| …saber por qué algo es como es    | [`docs/architecture/adr/`](docs/architecture/adr/)       |
| …trabajar con agentes de IA       | [`AGENTS.md`](AGENTS.md)                                 |

## Equipo

|     | Rol                          | Casos de uso                      |
| --- | ---------------------------- | --------------------------------- |
| A   | Backend Core                 | CU-01…CU-08                       |
| B   | Backend Reservas/Pagos       | CU-09, CU-11…CU-18                |
| C   | Frontend Editor              | CU-06…CU-08                       |
| D   | Frontend Operación/Dashboard | CU-09, CU-10, CU-15, CU-16, CU-18 |
| E   | Full-stack / QA / Verticales | CU-19…CU-24                       |
