# Contrato API — contexto para agentes

## Dónde estás

`openapi.yaml` es la **fuente de verdad ÚNICA** del contrato entre front y back.
Lo que NO va aquí: implementación. Aquí solo se describe la forma de la API.

## El flujo, sin excepciones

```
1. Editar openapi.yaml          ← SIEMPRE primero
2. pnpm api:lint                ← validar
3. pnpm api:gen                 ← generar cliente TS + interfaces Java
4. Recién ahora, implementar
```

Del contrato salen dos cosas:

- **`libs/api-client/src/lib/generated/`** — servicios y modelos tipados para Angular
- **interfaces Java** que los `@RestController` deben implementar

Consecuencia deliberada: si alguien cambia el contrato sin actualizar este archivo,
**el build de Java falla** porque el controlador ya no implementa la interfaz.
El contrato lo hace cumplir el compilador, no la buena voluntad.

## Reglas duras

1. **Nunca edites `**/generated/`.** Se regenera y no se commitea.
2. Todas las rutas bajo `/api/v1/`.
3. Los errores usan **RFC 9457 (Problem Details)** — el esquema `Problem`.
   Spring 6+ lo soporta nativamente.
4. El tenant sale del claim `tenant` del JWT, **no** de un parámetro ni de un header
   en las rutas de staff.
5. Cada endpoint lleva `operationId` (es el nombre del método generado),
   `summary` y sus respuestas de error.
6. WebSocket/STOMP **no** se describe aquí: OpenAPI no lo cubre. Va en
   `docs/api/` y los tipos de payload en `src/realtime.ts`.

## Por qué esto importa con 5 personas

2 backenders y 2 frontenders trabajan en paralelo sobre el mismo contrato sin bloquearse.
El frontend ni siquiera necesita el backend levantado:

```bash
pnpm api:mock     # Prism sirve el contrato en :4010
```

## Comandos

```bash
pnpm api:lint    # validar el yaml
pnpm api:gen     # regenerar
pnpm api:check   # ¿el contrato y lo generado están sincronizados? (corre en CI)
pnpm api:mock    # servidor mock
```
