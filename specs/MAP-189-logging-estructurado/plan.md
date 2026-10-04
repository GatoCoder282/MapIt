# Plan de implementación — MAP-189

## Secuencia

1. Contrato OpenAPI: cabecera opcional UUID y cabecera de respuesta; regeneración.
2. SLF4J/Logback y JSON nativo de Spring Boot, contexto HTTP y errores sanitizados.
3. Instrumentación de integraciones, seguridad y outbox usando su event_id existente.
4. Librería Angular compartida, interceptor limitado a la API y manejo global de errores.
5. Logs de Nginx y rotación Docker; verificaciones, ADR y guía de defensa.

## Patrones de diseño aplicados

| Mecanismo                         | Por qué aquí                                                      | Alternativa descartada                                      |
| --------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| Filtro HTTP e interceptor Angular | Correlación transversal sin repetirla en cada operación           | Instrumentar manualmente cada método                        |
| Adaptador de consola              | Un único punto de serialización y política de privacidad frontend | Llamadas console dispersas o plataforma externa innecesaria |
| Contexto MDC acotado              | Adjuntar identidad verificada a eventos de la ejecución           | Estado global compartido entre peticiones                   |
| Ports & Adapters existentes       | Instrumentar límites técnicos sin acoplar dominio                 | Importar logging/frameworks en entidades                    |

## Contratos

X-Request-ID es diagnóstico, no identidad. UUID canónico, regenerado ante entrada inválida. El tenant solo procede de identidad verificada. En tareas, el tenant viene del contexto interno de procesamiento. Eventos diferidos se enlazan mediante event_id, sin extender el esquema de BD ni el payload STOMP.

## Verificación

Validar JSON emitido, ausencia de secretos señuelo, correlación, estados HTTP, aislamiento concurrente y restauración del contexto. Probar degradación/recuperación y evitar ruido de sondeos. Ejecutar tests backend/frontend, Testcontainers, E2E y check completo. Registrar resultados reales en tasks.md.
