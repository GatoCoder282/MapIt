# Infraestructura de MapIt — modelo C4

Tres vistas del [modelo C4](https://c4model.com):

1. **Contexto** (nivel 1): quién usa MapIt y con qué sistemas externos habla.
2. **Despliegue de producción**: dónde corre cada pieza que usan los clientes.
3. **Despliegue del slot de QA**: cómo una rama `feat/**` llega a QA.

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

  Enterprise_Boundary(ext, "Servicios externos") {
    System_Ext(correo, "Correo transaccional", "Brevo en producción · Mailtrap Sandbox en QA")
    System_Ext(pasarela, "Pasarela de pago QR", "Hoy en modo mock (PAYMENT_PROVIDER=mock)")
    System_Ext(github, "GitHub", "Código, CI y workflow QA deploy")
  }

  Rel(cliente, mapit, "Reserva, paga y consulta", "HTTPS")
  Rel(staff, mapit, "Opera mapas, reservas y cobros", "HTTPS + WSS")
  Rel(superadmin, mapit, "Aprueba negocios", "HTTPS")
  Rel(equipo, github, "PR y etiqueta qa")
  Rel(mapit, correo, "Verificaciones e invitaciones", "SMTP 2525")
  Rel(mapit, pasarela, "Cobros QR")
  Rel(github, mapit, "Despliega el slot de QA")

  UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")
```

## 2. Despliegue de producción

```mermaid
C4Deployment
  title MapIt · Producción (rama main)

  Deployment_Node(vercel, "Vercel", "Plan Hobby · build en cada push a main") {
    Container(console, "console", "Angular 22", "map-it-n7y1.vercel.app")
    Container(web, "public-web", "Angular 22", "map-it-wuy2.vercel.app")
  }

  Deployment_Node(render, "Render detrás de Cloudflare", "Plan free · Oregon") {
    Container(api, "MapIt-production", "Spring Boot 4 · Java 25", "mapit-qmr4.onrender.com · auto-deploy tras CI si cambia apps/backend")
    Container(unleash, "MapIt-Unleash", "Unleash 6.10 OSS", "mapit-unleash.onrender.com · entorno production")
  }

  Deployment_Node(smtp, "Correo", "SMTP externo") {
    Container_Ext(brevo, "Brevo", "smtp-relay.brevo.com:2525", "Entrega a buzones reales")
  }

  Deployment_Node(neon, "Neon · rama production", "PostgreSQL serverless") {
    ContainerDb(db, "neondb", "PostgreSQL + RLS", "Datos de producción · migraciones Flyway")
    ContainerDb(unleashdb, "unleash", "PostgreSQL", "Flags, estrategias y tokens")
  }

  Rel(console, api, "REST + WebSocket", "HTTPS/WSS")
  Rel(web, api, "REST", "HTTPS")
  Rel(web, unleash, "Frontend API", "token client production")
  Rel(api, unleash, "Client API", "token backend production")
  Rel(api, db, "JDBC", "TLS")
  Rel(unleash, unleashdb, "SQL", "TLS")
  Rel(api, brevo, "SMTP", "STARTTLS")

  UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="2")
```

## 3. Despliegue del slot de QA

```mermaid
C4Deployment
  title MapIt · Slot de QA (una rama feat/** a la vez)

  Deployment_Node(gh, "GitHub", "GatoCoder282/MapIt") {
    Container(actions, "QA deploy", "GitHub Actions · qa-deploy.yml", "Etiqueta qa o workflow_dispatch")
  }

  Deployment_Node(vercel, "Vercel · Preview", "Un preview por commit de cada rama") {
    Container(consoleqa, "console QA", "Alias fijo", "mapit-qa-console.vercel.app")
    Container(webqa, "public-web QA", "Alias fijo", "mapit-qa-web.vercel.app")
  }

  Deployment_Node(render, "Render detrás de Cloudflare", "Plan free · Oregon") {
    Container(unleash, "MapIt-Unleash", "Compartido con producción", "entorno development")
    Container(apiqa, "MapIt-QA", "Spring Boot 4 · perfil dev", "mapit-qa.onrender.com · pagos mock")
  }

  Deployment_Node(neon, "Neon · rama preview", "Copia de production") {
    ContainerDb(dbqa, "neondb", "PostgreSQL + RLS", "Se restaura desde production al tomar el slot")
  }

  Deployment_Node(smtp, "Correo", "SMTP externo") {
    Container_Ext(mailtrap, "Mailtrap Sandbox", "sandbox.smtp.mailtrap.io:2525", "Captura todo; no entrega a buzones reales")
  }

  Rel(actions, consoleqa, "Asigna los alias", "Vercel CLI")
  Rel(actions, apiqa, "Fija la rama y despliega el commit", "API de Render")
  Rel(consoleqa, apiqa, "REST + WebSocket", "HTTPS/WSS")
  Rel(webqa, apiqa, "REST", "HTTPS")
  Rel(apiqa, unleash, "Client API", "token backend development")
  Rel(apiqa, dbqa, "JDBC", "TLS")
  Rel(actions, dbqa, "Reset desde production", "API de Neon")
  Rel(apiqa, mailtrap, "SMTP", "STARTTLS")

  UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="2")
```

### Cómo leerlo

- **Producción y QA comparten el servidor de Unleash**, pero cada uno usa su entorno
  (`production` o `development`) y sus propios tokens. Console y public-web leen los flags desde el
  navegador; en los diagramas se dibuja una sola flecha de frontend para no saturarlos.
- **La base de QA es una copia de producción** (rama `preview` de Neon). `QA deploy` la restaura
  cada vez que una rama toma el slot; un push nuevo a la misma rama redespliega sin restaurarla.
- **Cloudflare** está delante de Render. Por eso el backend lee la IP del cliente de
  `CF-Connecting-IP` (ver [runbook](README.md)).
- **Plan free de Render:** los servicios se duermen tras 15 min sin tráfico y tardan unos 4 min en
  arrancar. El auto-deploy de producción solo corre si el commit toca `apps/backend/**`,
  `infra/docker/backend.Dockerfile` o `.dockerignore` (Build Filters).
