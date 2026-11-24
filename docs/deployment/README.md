# Despliegue — entornos, variables y slot de QA

Runbook de los entornos desplegados de MapIt. Las decisiones están en
[ADR-0012](../architecture/adr/ADR-0012-entornos-desplegados-y-slot-qa.md) (entornos y slot QA) y
[ADR-0013](../architecture/adr/ADR-0013-unleash-frontend-api-en-despliegues.md) (Unleash en el navegador).

## Entornos

| Pieza            | Producción (`main`)                                        | QA (slot: una rama `feat/**` a la vez)           |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| Console (Vercel) | `https://map-it-n7y1.vercel.app`                           | `https://mapit-qa-console.vercel.app` (alias)    |
| Public web       | `https://map-it-wuy2.vercel.app`                           | `https://mapit-qa-web.vercel.app` (alias)        |
| API (Render)     | `https://mapit-qmr4.onrender.com` (MapIt-production)       | `https://mapit-qa.onrender.com` (MapIt-QA)       |
| BD (Neon)        | rama `production`                                          | rama `preview`, hija de `production`             |
| Unleash          | `https://mapit-unleash.onrender.com`, entorno `production` | mismo servidor, entorno `development`            |
| Correo           | Brevo `smtp-relay.brevo.com:2525`                          | Mailtrap Sandbox `sandbox.smtp.mailtrap.io:2525` |

- Producción se despliega sola al mergear en `main`: Vercel construye las dos apps y Render despliega
  MapIt-production cuando pasan los checks.
- Toda rama `feat/**` genera previews de Vercel (`vercel.json`) que apuntan al **backend de QA**.
- **Nunca actives las PR Previews de Render en MapIt-production**: copian su `DB_URL` y ejecutan las
  migraciones de una rama sin mergear contra la BD de producción.

## Usar el slot QA

1. Rebasea la rama sobre `main` (Flyway rechaza migraciones que choquen con las ya aplicadas).
2. Pon la etiqueta **`qa`** en el PR, o lanza a mano:
   `gh workflow run qa-deploy.yml -f branch=feat/<usuario>/<ticket>-<slug>` (añade `-f reset_db=false`
   para conservar los datos de QA).
3. El workflow `QA deploy` (`.github/workflows/qa-deploy.yml`):
   1. espera los previews de Vercel de ese commit;
   2. restaura Neon `preview` desde `production` (solo al tomar el slot, no en cada push);
   3. apunta MapIt-QA a la rama y despliega ese commit exacto;
   4. espera `readiness` UP y asigna los alias fijos de QA a los previews;
   5. quita la etiqueta `qa` de otros PR y comenta las URLs en el tuyo.
4. Cada push nuevo al PR con la etiqueta redespliega sin borrar datos.
5. Para liberar el backend: `gh workflow run qa-deploy.yml -f branch=main`.

Notas del slot:

- Una rama a la vez. Los demás previews `feat/**` también hablan con `mapit-qa`, pero solo los
  alias corresponden al backend desplegado.
- La BD de QA es una copia de producción (incluye datos personales y el SUPER_ADMIN de prod).
  Los correos de QA no salen: llegan al inbox de Mailtrap.
- Render free duerme el servicio tras 15 min sin tráfico: la primera petición tarda ~60 s.
- Los pagos QR mock funcionan en QA (`APP_ENV=staging` en el frontend y perfil `dev` en el backend);
  en producción no.

## Variables

🔒 = secreto: se carga solo en el panel del proveedor, nunca en el repo ni en el chat.

### Render · MapIt-production

| Variable                                                                  | Valor                                                                                   |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `APP_ENV`                                                                 | `production`                                                                            |
| `PORT`                                                                    | lo inyecta Render (`10000`)                                                             |
| `DB_URL`                                                                  | `jdbc:postgresql://<endpoint directo>/neondb?sslmode=require`, sin `user=`/`password=`  |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` 🔒                                  | owner de Neon (Flyway)                                                                  |
| `MAPIT_APP_DB_USER` / `MAPIT_APP_DB_PASSWORD` 🔒                          | `mapit_app` / contraseña de runtime                                                     |
| `JWT_SECRET` 🔒, `JWT_ISSUER`, `JWT_ACCESS_TTL_MIN`                       | secreto propio, `mapit`, `15`                                                           |
| `CORS_ALLOWED_ORIGINS`                                                    | `https://map-it-n7y1.vercel.app,https://map-it-wuy2.vercel.app` (exactos, sin patrones) |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_FULL_NAME` / `SUPER_ADMIN_PASSWORD` 🔒 | cuenta de plataforma                                                                    |
| `PUBLIC_WEB_URL`                                                          | `https://map-it-wuy2.vercel.app` (enlaces de los correos)                               |
| `MAIL_HOST` / `MAIL_PORT`                                                 | `smtp-relay.brevo.com` / `2525`                                                         |
| `MAIL_USERNAME` 🔒 / `MAIL_PASSWORD` 🔒                                   | login SMTP de Brevo / **SMTP key** (no la API key)                                      |
| `MAIL_SMTP_AUTH` / `MAIL_SMTP_STARTTLS`                                   | `true` / `true`                                                                         |
| `MAIL_FROM`                                                               | remitente verificado en Brevo                                                           |
| `UNLEASH_ENABLED` / `UNLEASH_URL`                                         | `true` / `https://mapit-unleash.onrender.com/api`                                       |
| `UNLEASH_API_TOKEN` 🔒 / `UNLEASH_ENVIRONMENT`                            | token **backend** de `production` / `production`                                        |
| `SERVER_FORWARDHEADERSSTRATEGY`                                           | `native` (IP real del cliente para los límites de login/historial)                      |

Ajustes: Health Check Path `/actuator/health/readiness`; PR Previews **Off**; Auto-Deploy
"After CI checks pass".

### Render · MapIt-QA

Igual que producción salvo:

| Variable                                       | Valor                                                                                                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`                                      | `staging`                                                                                                                                                                                 |
| `SPRING_PROFILES_ACTIVE`                       | `dev` exactamente (habilita los pagos mock)                                                                                                                                               |
| `DB_URL`                                       | endpoint **directo** (no `-pooler`) de la rama `preview`                                                                                                                                  |
| `POSTGRES_*` 🔒, `MAPIT_APP_DB_*` 🔒           | **iguales a producción**: el reset copia los roles y sus contraseñas                                                                                                                      |
| `JWT_SECRET` 🔒 / `JWT_ISSUER`                 | **distinto** de producción / `mapit-qa`                                                                                                                                                   |
| `CORS_ALLOWED_ORIGINS`                         | `https://mapit-qa-console.vercel.app,https://mapit-qa-web.vercel.app,https://map-it-n7y1-*-diegos-projects-03cdb86b.vercel.app,https://map-it-wuy2-*-diegos-projects-03cdb86b.vercel.app` |
| `PUBLIC_WEB_URL`                               | `https://mapit-qa-web.vercel.app`                                                                                                                                                         |
| `MAIL_HOST` / `MAIL_PORT`                      | `sandbox.smtp.mailtrap.io` / `2525`                                                                                                                                                       |
| `MAIL_USERNAME` 🔒 / `MAIL_PASSWORD` 🔒        | credenciales del inbox de Mailtrap                                                                                                                                                        |
| `MAIL_FROM`                                    | `qa@mapit.test`                                                                                                                                                                           |
| `UNLEASH_API_TOKEN` 🔒 / `UNLEASH_ENVIRONMENT` | token **backend** de `development` / `development`                                                                                                                                        |

Ajustes: Health Check Path `/actuator/health/readiness`. La rama y el auto-deploy los gestiona el
workflow `QA deploy` (deja el auto-deploy en `off`).

### Render · MapIt-Unleash

Imagen `unleashorg/unleash-server` (versión fijada), BD `unleash` en la rama `production` de Neon
(nunca en `preview`, que se resetea).

| Variable             | Valor                                                              |
| -------------------- | ------------------------------------------------------------------ |
| `DATABASE_URL` 🔒    | `postgres://<owner>:<pwd>@<endpoint prod>/unleash?sslmode=require` |
| `PORT` / `HTTP_PORT` | `4242`                                                             |
| `UNLEASH_URL`        | `https://mapit-unleash.onrender.com`                               |

Tras el primer arranque: cambiar la contraseña de `admin`, crear tokens (backend y frontend para
`production` y `development`, y uno admin para sembrar), y en Admin → CORS origins añadir los
orígenes de Vercel. Sembrar flags una vez por entorno:
`UNLEASH_URL=https://mapit-unleash.onrender.com/api UNLEASH_ADMIN_TOKEN=<admin> UNLEASH_ENVIRONMENT=<entorno> pnpm db:seed:flags`.

### Vercel · `map-it-n7y1` (console) y `map-it-wuy2` (public-web)

Build Command: `pnpm api:gen && pnpm exec ng build <app> --configuration production && node tools/scripts/frontend-config.mjs <app>`.
`frontend-config.mjs` convierte estas variables en `assets/config.json`:

| Variable                        | Production                                        | Preview (QA)                           |
| ------------------------------- | ------------------------------------------------- | -------------------------------------- |
| `API_BASE_URL`                  | `https://mapit-qmr4.onrender.com/api/v1`          | `https://mapit-qa.onrender.com/api/v1` |
| `WS_URL` (opcional)             | `wss://mapit-qmr4.onrender.com/ws`                | `wss://mapit-qa.onrender.com/ws`       |
| `CONSOLE_BASE_URL` (public-web) | `https://map-it-n7y1.vercel.app`                  | `https://mapit-qa-console.vercel.app`  |
| `PUBLIC_WEB_URL`                | `https://map-it-wuy2.vercel.app`                  | `https://mapit-qa-web.vercel.app`      |
| `APP_ENV`                       | `production`                                      | `staging`                              |
| `UNLEASH_FRONTEND_URL`          | `https://mapit-unleash.onrender.com/api/frontend` | igual                                  |
| `UNLEASH_FRONTEND_TOKEN`        | token **frontend** de `production`                | token **frontend** de `development`    |

- Sin `WS_URL` se deriva del origen de la API (`wss://<host>/ws`).
- Sin Unleash, los flags quedan en los defaults del catálogo.
- Deployment Protection: Vercel Authentication **desactivado** (QA y el QR del móvil deben abrir
  los previews sin cuenta de Vercel).
- Un cambio de variables Preview solo aplica a builds nuevos: haz un push después.

### GitHub (workflow `QA deploy`)

- Entorno **`qa`** con deployment branches limitadas a `main`. Secretos del entorno 🔒:
  `RENDER_API_KEY`, `NEON_API_KEY` (con alcance del proyecto), `VERCEL_TOKEN`.
- Variables del repo: `RENDER_QA_SERVICE_ID`, `NEON_PROJECT_ID`, `NEON_PREVIEW_BRANCH_ID`,
  `VERCEL_SCOPE`, `QA_CONSOLE_ALIAS`, `QA_WEB_ALIAS`.
- Etiqueta `qa`.

## Solución de problemas

| Síntoma                                                                                                                      | Causa y arreglo                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El backend no arranca: `Validate failed: Migration checksum mismatch` o `description mismatch`                               | La BD tiene una migración con otro contenido o nombre. Nunca edites una migración aplicada; en QA, rebasea y relanza con `reset_db=true`.                                                                                                                                   |
| El alta de empresa responde 503                                                                                              | No hay SMTP: revisa `MAIL_*`. Render free bloquea 25/465/587: usa 2525 con auth y STARTTLS.                                                                                                                                                                                 |
| El navegador falla por CORS desde un preview                                                                                 | Añade el patrón del proyecto en `CORS_ALLOWED_ORIGINS` de MapIt-QA. Producción solo orígenes exactos; `*` está prohibido.                                                                                                                                                   |
| Un alias abre el login de Vercel                                                                                             | Desactiva Vercel Authentication en Deployment Protection del proyecto.                                                                                                                                                                                                      |
| `config.json` apunta a producción en un preview                                                                              | `API_BASE_URL` está con scope "Production and Preview": sepáralo y redeploya.                                                                                                                                                                                               |
| Los flags no cambian en el navegador                                                                                         | Revisa `UNLEASH_FRONTEND_*` del entorno y los CORS origins del servidor Unleash.                                                                                                                                                                                            |
| Deploy de Render cancelado por timeout del health check; el log se corta tras `WebApplicationContextInitializer`, sin Flyway | Render free durmió el servicio (15 min sin tráfico) a mitad del deploy y congeló la instancia nueva. La BD no cambia. Abre la app para despertarla y, mientras responde, haz **Manual Deploy → Deploy latest commit**. El workflow QA deploy ya hace estas peticiones solo. |
