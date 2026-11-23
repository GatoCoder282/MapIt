# ADR-0012 — Entornos desplegados con un slot de QA compartido

- **Estado:** Aceptado
- **Fecha:** 2026-11-22
- **Deciden:** equipo MapIt

## Contexto

MapIt se despliega en planes gratuitos: Vercel Hobby (console y public-web), Render free (backend
Spring Boot en Docker) y Neon free (PostgreSQL con ramas). QA necesita probar cada rama `feat/**`
con su frontend **y** su backend, sin tocar los datos de producción.

Restricciones reales:

- Render free comparte 750 h/mes entre servicios y duerme cada uno tras 15 min sin tráfico.
- Las PR Previews de Render copian las variables del servicio padre. Activadas en producción,
  ejecutaron las migraciones de un PR sin mergear contra la BD de producción (19/11/2026).
- Las URL de los previews de Vercel cambian en cada commit, pero el backend necesita orígenes
  CORS y enlaces de correo estables.
- Neon free permite ramas instantáneas copiadas de otra rama.

## Decisión

Dos entornos:

- **Producción**: `main` → Vercel Production + Render `MapIt-production` + Neon `production`.
- **QA, como slot compartido**: una sola rama `feat/**` ocupa a la vez Render `MapIt-QA` + Neon
  `preview` + dos alias fijos de Vercel. El workflow `qa-deploy.yml` (manual o con la etiqueta `qa`)
  hace el cambio: restaura `preview` desde `production`, apunta MapIt-QA al commit exacto y asigna
  los alias a los previews de ese commit.

Reglas que acompañan la decisión:

- Las variables Preview de Vercel apuntan siempre al backend de QA.
- CORS acepta **patrones** solo para los previews en QA; producción lista orígenes exactos y `*`
  está prohibido.
- `APP_ENV=staging` identifica el entorno QA. En el frontend habilita los métodos de pago mock;
  el backend de QA corre con el perfil `dev`, que sigue siendo la puerta real (HU-6.03).
- El correo de QA va a un sandbox (Mailtrap) y el de producción a Brevo, ambos por el puerto 2525
  porque Render free bloquea 25/465/587.
- Los secretos del workflow viven en el entorno de GitHub `qa`, restringido a `main`; el workflow
  nunca ejecuta código del PR (`pull_request_target` sin checkout).

## Alternativas consideradas

| Opción                                    | Por qué no                                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QA siempre en `main`                      | Los cambios de backend de una rama solo se probarían después de mergear; QA dejaría de servir para aprobar PR.                                                |
| Un backend por PR (PR Previews de Render) | Multiplica las horas gratuitas, todas las instancias compartirían una sola BD (las migraciones chocan) y el frontend tendría que adivinar la URL del backend. |
| Una rama Neon por PR                      | Requiere reescribir `DB_URL` de cada instancia de preview por API; demasiadas piezas móviles para un equipo de 5.                                             |
| Alias por rama en vez de alias fijos      | Los enlaces de los correos y CORS no podrían ser estáticos; las URL de rama de Vercel se truncan con hash.                                                    |

## Consecuencias

- QA prueba una rama a la vez; los demás previews existen pero hablan con el backend del slot.
- Cada vez que una rama toma el slot, la BD de QA es una copia fresca de producción (con sus datos
  personales); por eso los correos de QA nunca salen del sandbox.
- Una rama atrasada respecto a `main` puede fallar la validación de Flyway: hay que rebasear antes.
- El despliegue depende de tres tokens (Render, Neon, Vercel) guardados en el entorno `qa`.
