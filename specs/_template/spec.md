# {{CODIGO}} — <título del caso de uso>

> **Estado:** Borrador · **Creada:** {{FECHA}} · **Responsable:** <integrante A–E>

## Enunciado

{{ENUNCIADO}}

---

## 1. Por qué (contexto)

<¿Qué problema del negocio resuelve? ¿Qué pasa hoy sin esto? Dos o tres frases.
Si no puedes explicar por qué importa, probablemente no toque construirlo aún.>

## 2. Actores

| Rol                                             | Qué hace en este caso de uso |
| ----------------------------------------------- | ---------------------------- |
| <Manager / Staff / Cliente final / Super Admin> |                              |

## 3. Precondiciones

- <qué debe existir o ser cierto antes de empezar>

## 4. Flujo principal

1. <paso>
2. <paso>

## 5. Flujos alternativos y errores

| Situación             | Comportamiento esperado      |
| --------------------- | ---------------------------- |
| <qué puede salir mal> | <qué debe pasar exactamente> |

## 6. Reglas de negocio

- **RN-1:** <regla que el código debe hacer cumplir>

## 7. Criterios de aceptación

Redactados de forma **verificable**: si no se puede escribir un test que lo compruebe,
está mal redactado.

- [ ] **CA-1:** Dado <contexto>, cuando <acción>, entonces <resultado observable>.
- [ ] **CA-2:**

## 8. Fuera de alcance

Lo que este caso de uso **no** cubre, para que nadie lo dé por supuesto:

- <...>

## 9. Impacto multi-tenant

- ¿Las tablas nuevas llevan `tenant_id` + RLS? <sí / no aplica>
- ¿Hay un test que compruebe que el tenant A no ve datos del B? <sí / no aplica>

## 10. Requerimientos relacionados

RF<xx>, RNF<xx> de `docs/roadmap/project_definition.md`.
