# ADR-0008 — Consulta de credenciales con contexto temporal antes del JWT

- **Estado:** Propuesto (implementado en MAP-46 para revisión)
- **Fecha:** 2026-09-09
- **Deciden:** Pendiente de revisión de MAP-46 por el responsable

## Contexto

`app_user` define correos únicos por tenant, no globalmente. Al iniciar sesión aún
no hay un JWT del que extraer el tenant. El contexto de demostración existente no
representa la identidad del usuario. Se necesita consultar las credenciales sin
abrir la tabla globalmente ni dejar un contexto residual en el pool.

## Decisión

La entrada del caso de uso incluye slug de empresa, correo y contraseña. El
repositorio resuelve el slug en `tenant`, fija `app.tenant_id` con
`set_config(..., true)` y consulta `app_user` por tenant y correo usando JDBC.
La consulta corre en una transacción `REQUIRES_NEW` de solo lectura; RLS sigue
forzada y el contexto desaparece al cerrarla. Las comprobaciones de contraseña,
usuario activo y tenant activo se realizan antes de devolver la identidad.

Esta consulta previa al login es la excepción acotada al filtro Hibernate de
ADR-0004: mantiene tanto filtro explícito como RLS. Las futuras consultas de
negocio autenticadas conservarán el tenant del JWT. Elegir una empresa durante
el login no autoriza a consultar sus recursos.

## Alternativas consideradas

| Opción                                    | Por qué no                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| Buscar solo por correo                    | Puede identificar cuentas distintas en empresas diferentes                                    |
| Usar el tenant demo                       | Autenticaría contra una empresa fija, ajena a la solicitud                                    |
| Deshabilitar RLS o usar un rol con bypass | Abre la lectura de credenciales entre empresas                                                |
| Usar una sesión Hibernate compartida      | Su tenant se fija antes de validar la identidad; complica la separación del contexto exterior |

## Consecuencias

MAP-48 tendrá que reflejar el selector de empresa en el contrato de login y
MAP-49 en la pantalla. El repositorio requiere una conexión adicional si lo llama
una transacción existente. Se verifica con un rol PostgreSQL sin bypass que las
filas estén aisladas, el contexto exterior se conserve y las conexiones se
reutilicen sin arrastrar el tenant del login anterior.
