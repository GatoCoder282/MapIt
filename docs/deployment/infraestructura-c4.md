# Infraestructura de MapIt — modelo C4

Dos vistas del [modelo C4](https://c4model.com):

1. **Contexto** (nivel 1): quién usa MapIt y con qué sistemas externos habla.
2. **Despliegue**: dónde corre cada pieza en producción y en el slot de QA.

GitHub dibuja los diagramas al abrir este archivo. Para editarlos, pega el bloque en
<https://mermaid.live>. Los valores de las variables de entorno están en el [runbook](README.md).

## 1. Contexto

```mermaid
C4Context
  title MapIt · Contexto del sistema

  Person(cliente, "Cliente", "Reserva espacios, paga con QR y consulta su historial en public-web")
  Person(staff, "Staff del negocio", "ADMIN, MANAGER y STAFF operan su negocio en console")
  Person(superadmin, "Super Admin", "Aprueba solicitudes de incorporación y administra tenants")
  Person(equipo, "Equipo de desarrollo y QA", "Prueba cada rama feat/** en el slot de QA")

  System(mapit, "MapIt", "Plataforma multi-tenant de reservas de espacios")

  System_Ext(correo, "Correo transaccional", "Brevo en producción · Mailtrap Sandbox en QA")
  System_Ext(github, "GitHub", "Código, CI y workflow QA deploy")
  System_Ext(pasarela, "Pasarela de pago QR", "Hoy en modo mock (PAYMENT_PROVIDER=mock)")

  Rel(cliente, mapit, "Reserva, paga y consulta", "HTTPS")
  Rel(staff, mapit, "Opera mapas, reservas y cobros", "HTTPS + WSS")
  Rel(superadmin, mapit, "Aprueba negocios", "HTTPS")
  Rel(equipo, github, "PR y etiqueta qa")
  Rel(github, mapit, "Despliega el slot de QA", "APIs de Render, Neon y Vercel")
  Rel(mapit, correo, "Verificaciones, invitaciones y enlaces mágicos", "SMTP 2525")
  Rel(mapit, pasarela, "Cobros QR")

  UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")
```

## 2. Despliegue (producción y slot de QA)

```mermaid
C4Deployment
  title MapIt · Infraestructura desplegada

  Deployment_Node(vercel, "Vercel", "Plan Hobby · frontends estáticos") {
    Deployment_Node(vprod, "Production", "rama main") {
      Container(console, "console", "Angular 22", "map-it-n7y1.vercel.app")
      Container(web, "public-web", "Angular 22", "map-it-wuy2.vercel.app")
    }
    Deployment_Node(vqa, "Preview", "ramas feat/**") {
      Container(consoleqa, "console QA", "alias fijo", "mapit-qa-console.vercel.app")
      Container(webqa, "public-web QA", "alias fijo", "mapit-qa-web.vercel.app")
    }
  }

  Deployment_Node(render, "Render detrás de Cloudflare", "Plan free · Oregon · duerme tras 15 min sin tráfico") {
    Container(api, "MapIt-production", "Spring Boot 4 · Java 25", "mapit-qmr4.onrender.com · auto-deploy tras CI, solo si cambia apps/backend")
    Container(apiqa, "MapIt-QA", "Spring Boot 4 · perfil dev", "mapit-qa.onrender.com · la rama la fija el workflow")
    Container(unleash, "MapIt-Unleash", "Unleash 6.10 OSS", "mapit-unleash.onrender.com · entornos production y development")
  }

  Deployment_Node(neon, "Neon", "PostgreSQL serverless") {
    Deployment_Node(nprod, "Rama production") {
      ContainerDb(db, "neondb", "PostgreSQL + RLS", "Datos de producción · Flyway")
      ContainerDb(unleashdb, "unleash", "PostgreSQL", "Flags, estrategias y tokens")
    }
    Deployment_Node(nqa, "Rama preview") {
      ContainerDb(dbqa, "neondb (copia)", "PostgreSQL + RLS", "Se restaura desde production al tomar el slot")
    }
  }

  Deployment_Node(gh, "GitHub", "GatoCoder282/MapIt") {
    Container(actions, "GitHub Actions", "ci.yml · qa-deploy.yml", "CI de cada PR · mueve el slot de QA")
  }

  System_Ext(brevo, "Brevo", "SMTP de producción")
  System_Ext(mailtrap, "Mailtrap Sandbox", "SMTP de QA; no entrega a buzones reales")

  Rel(console, api, "REST + WebSocket", "HTTPS/WSS")
  Rel(web, api, "REST", "HTTPS")
  Rel(consoleqa, apiqa, "REST + WebSocket", "HTTPS/WSS")
  Rel(webqa, apiqa, "REST", "HTTPS")
  Rel(console, unleash, "Frontend API", "token client production")
  Rel(consoleqa, unleash, "Frontend API", "token client development")
  Rel(api, unleash, "Client API", "token backend production")
  Rel(apiqa, unleash, "Client API", "token backend development")
  Rel(api, db, "JDBC · Flyway", "TLS")
  Rel(apiqa, dbqa, "JDBC · Flyway", "TLS")
  Rel(unleash, unleashdb, "SQL", "TLS")
  Rel(api, brevo, "SMTP", "2525 STARTTLS")
  Rel(apiqa, mailtrap, "SMTP", "2525 STARTTLS")
  Rel(actions, dbqa, "Reset desde production", "API de Neon")
  Rel(actions, apiqa, "Rama y deploy del commit", "API de Render")
  Rel(actions, consoleqa, "Asigna los alias", "Vercel CLI")

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="2")
```

### Cómo leerlo

- **Producción y QA comparten Unleash**, pero cada uno usa su entorno (`production` o
  `development`) y sus propios tokens. Los dos frontends leen los flags desde el navegador; en el
  diagrama solo se dibujan las flechas de console para no saturarlo.
- **La base de QA es una copia de producción** (rama `preview` de Neon). El workflow `QA deploy` la
  restaura cada vez que una rama toma el slot.
- **Cloudflare** está delante de Render. Por eso el backend lee la IP del cliente de
  `CF-Connecting-IP` (ver [runbook](README.md)).
- **Plan free de Render:** los servicios se duermen tras 15 min sin tráfico y tardan unos 4 min en
  arrancar. El auto-deploy de producción solo corre si el commit toca `apps/backend/**`,
  `infra/docker/backend.Dockerfile` o `.dockerignore` (Build Filters).
