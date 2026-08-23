# Infraestructura — contexto para agentes

## Dónde estás

Docker Compose para desarrollo local y ensayo de despliegue. El despliegue real no está
previsto todavía, pero validamos desde ahora que todo corre en contenedores.

## Los tres compose

| Archivo             | Qué levanta                                           | Cuándo                                   |
| ------------------- | ----------------------------------------------------- | ---------------------------------------- |
| `compose.yml`       | postgres, unleash, unleash-db, unleash-proxy, mailpit | **siempre** (`pnpm dev` lo hace solo)    |
| `compose.tools.yml` | sonarqube, pgadmin, prism                             | a demanda (`pnpm infra:tools`)           |
| `compose.full.yml`  | + backend y las 2 apps contenerizadas                 | ensayo de despliegue (`pnpm infra:full`) |

## Reglas duras

1. **PostgreSQL escucha en el 5433 en el host**, no en el 5432, para no chocar con
   instalaciones nativas. Dentro de la red de Docker el contenedor sigue en 5432.
2. **SonarQube solo en la máquina de calidad**, y con cadencia baja. Cinco instancias
   producen cinco historiales y ninguna métrica confiable: Sonar mide _tendencia sobre
   código nuevo_. El resto del equipo usa SonarLint conectado a esa instancia.
3. **El frontend NUNCA habla directo con Unleash**: pasa por `unleash-proxy` (:3063).
   Exponer el servidor al navegador filtraría todo el catálogo de flags y el token admin.
4. **No definas `PROXY_BASE_PATH`** en unleash-proxy: ya sirve en `/proxy` por sí solo,
   y la variable se antepone, dando `/proxy/proxy`.
5. Los tokens de Unleash tienen formato `<proyecto>:<entorno>.<secreto>`, y el de **admin
   debe ser de alcance global** (`*:*`). Un token admin con alcance de proyecto hace que
   el contenedor no arranque.

## Feature flags

```bash
pnpm new:flag payments.qr release     # crea la flag en los 3 sitios coherentemente
```

Los tres sitios son: el enum Java, el catálogo TypeScript y `unleash/flags.json`.
Luego hay que crearla también en la UI (<http://localhost:4242>, `admin`/`unleash4all`).

Convención de nombres: `<dominio>.<feature>`.
Tipos: `release` (temporal, con fecha de retiro) · `kill-switch` (permanente) ·
`experiment` (A/B) · `permission` (por tenant o rol).

## Variables de entorno

`.env.example` es la plantilla; `pnpm setup` genera el `.env` real con un `JWT_SECRET`
propio de cada máquina. Si añades una variable, añádela a `.env.example`: `pnpm doctor`
verifica que ninguna falte y `pnpm setup` las añade a los `.env` existentes.

## Comandos

```bash
pnpm infra:up / down / ps / logs
pnpm infra:reset     # ⚠️ borra volúmenes: BD y flags desde cero
pnpm infra:tools     # sonarqube, pgadmin, prism
pnpm infra:full      # todo contenerizado
```
