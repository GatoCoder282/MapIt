# Specs — contexto para agentes

## Dónde estás

Una carpeta por caso de uso (CU-01…CU-24). Es el corazón del **Spec-Driven Development**:
como el código lo escribe mayormente un agente, el entregable valioso es la
especificación, y el código es su consecuencia.

## El ciclo

```bash
pnpm new:spec CU-12-crear-reserva
```

Tres archivos, llenados **en orden**:

| Archivo    | Responde                                                                            | Se escribe antes de |
| ---------- | ----------------------------------------------------------------------------------- | ------------------- |
| `spec.md`  | **QUÉ** y **POR QUÉ**: criterios de aceptación, reglas de negocio, fuera de alcance | pensar en código    |
| `plan.md`  | **CÓMO**: módulos, contrato, migraciones, **patrones de diseño**                    | escribir código     |
| `tasks.md` | tareas ejecutables y verificables, en orden                                         | empezar             |

## Reglas duras

1. **No escribas código sin `spec.md` aprobada.** Si la especificación no está clara,
   el código tampoco lo estará.
2. **La sección "Patrones de diseño aplicados" de `plan.md` es obligatoria.** Con sus
   columnas _por qué aquí_ y _alternativa descartada_: un patrón que no se justifica,
   se cae. Meter patrones para lucirlos hace daño.
   Catálogo: `docs/architecture/design-patterns.md`.
3. **Los criterios de aceptación deben ser verificables.** Si no se puede escribir un test
   que lo compruebe, está mal redactado. Formato: _Dado… cuando… entonces…_
4. **Si el CU crea tablas**, `spec.md` §9 debe decir cómo se aísla por tenant, y
   `tasks.md` debe incluir el test de aislamiento.
5. **Rellena las "Notas de ejecución" de `tasks.md`.** Es lo que demuestra que el equipo
   entendió lo que se construyó — y es lo que se defiende ante el docente.

## Contexto de dominio

El alcance real está en `docs/roadmap/use_cases.md`, que **manda** sobre
`project_definition.md`. 24 casos de uso, 5 roles, 4 verticales, multi-tenant.

## Antes de dar por terminado un CU

- [ ] Todos los criterios de aceptación de `spec.md` marcados
- [ ] `pnpm check` en verde
- [ ] `docs/db/mapit.dbml` actualizado si cambió el esquema
- [ ] Notas de ejecución escritas
