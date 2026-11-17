# ADR-0011 — Correo único de Console por cuenta

- **Estado** · Aceptado para MAP-256
- **Fecha** · 2026-11-10

## Contexto

ADR-0008 definió el acceso por slug, correo y contraseña. El login
unificado debe identificar la empresa de cada usuario a partir de su correo.

## Decisión

V32 añade una restricción única al correo normalizado de `app_user`. La consulta
de login habilita la lectura de esa fila con RLS, en una transacción de solo lectura
que fija el correo localmente. BCrypt valida la contraseña antes de emitir el JWT
con el sujeto, tenant y rol de la cuenta.

## Alternativas consideradas

| Opción                               | Motivo para descartarla                                           |
| ------------------------------------ | ----------------------------------------------------------------- |
| Identidad con varias membresías      | El correo pertenece a una sola empresa según la regla de negocio. |
| Desactivar RLS para buscar la cuenta | Una búsqueda por correo solo requiere leer una fila.              |

## Consecuencias

Las invitaciones conservan el tenant para validar la activación y enlazan a `/login`.
El administrador de plataforma usa el mismo login y conserva los permisos del JWT de `platform`.
Una base con correos duplicados
debe resolverlos antes de aplicar V32. La migración conserva las filas existentes y
falla si encuentra duplicados.
