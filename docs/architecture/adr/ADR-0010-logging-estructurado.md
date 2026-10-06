# ADR-0010 — Logging estructurado y correlación de operaciones

- **Estado:** Aceptado
- **Fecha:** 2026-10-04
- **Decisión solicitada por:** Diego Valdez, MAP-189
- **Historia:** [MAP-189](https://matiasmv2005.atlassian.net/browse/MAP-189)

## Contexto

El backend tenía SLF4J disponible pero su uso propio se limitaba al bootstrap del superadministrador. Las apps Angular usaban console directamente. El outbox reintentaba eventos sin logs correlacionados y guardaba mensajes arbitrarios de excepciones. Una URL de activación contiene secretos, por lo que registrar peticiones completas también es una fuga.

## Decisión

Usamos SLF4J con Logback y el formato JSON Logstash nativo de Spring Boot. Los campos operativos son explícitos y los mensajes de aplicación pertenecen a un catálogo controlado. INFO es el nivel habitual; DEBUG se habilita por configuración. No añadimos un encoder externo ni otro framework de logging.

Cada petición lleva un X-Request-ID UUID: se valida, normaliza y devuelve, o se genera. Ese valor permite búsqueda, pero no autentica al cliente ni es globalmente único si lo reutiliza deliberadamente. MDC mantiene el contexto durante la ejecución; se restaura al salir, incluso ante error. El tenant se adjunta solamente tras verificar identidad. Las tareas de outbox establecen su contexto interno por tenant y usan el event_id persistido. El registro de encolado conecta request_id con event_id sin cambiar la BD.

Las apps comparten @mapit/logging: serialización segura, niveles, interceptor limitado al origen y prefijo de la API y ErrorHandler. El navegador conserva los registros localmente. No hay endpoint de ingesta ni almacenamiento de logs frontend en backend.

Aplicamos una política de datos permitidos. No se registran cuerpos, tokens, cookies, correos, objetos Error crudos ni URLs completas. Las excepciones conservan clases y ubicaciones de código, omitiendo mensajes arbitrarios. Esto también debe aplicarse a errores de dependencias que pueden incluir SQL o valores del usuario.

Nginx registra categorías de recursos, método permitido, estado y duración en JSON. Su error_log por petición se desactiva porque no permite sanitizar la URL; los errores operativos de arranque siguen disponibles y los errores HTTP quedan en access_log. Docker rota los logs de las tres aplicaciones (10 MB × 3 por contenedor).

## Alternativas consideradas

| Opción                                              | Por qué no                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| console/System.out en cada sitio                    | Sin formato, privacidad ni niveles verificables                               |
| Cambiar a Log4j2 o añadir encoder JSON externo      | Boot ya proporciona el mecanismo requerido                                    |
| Logger en cada entidad y método                     | Mezcla dominio y diagnóstico, multiplica ruido y duplicados                   |
| Registrar cuerpos y mensajes completos para depurar | Puede exponer credenciales, SQL, datos personales y enlaces de activación     |
| Loki/ELK/Sentry y trazas distribuidas ahora         | Ampliaría MAP-189 con operación, retención y acceso a una plataforma          |
| Persistir request_id en el outbox                   | event_id ya permite seguir la operación diferida; no hace falta una migración |

## Consecuencias

Los eventos se pueden buscar por identificadores y comparar entre capas. El contrato HTTP incorpora una cabecera opcional y una respuesta consistente. Se preserva el dominio sin frameworks.

La privacidad reduce el texto arbitrario disponible para depurar: se consulta el código por tipo y frames, usando eventos controlados para causas conocidas. No afirmamos que cualquier log futuro sea seguro: los tests, las restricciones de impresión y la revisión del catálogo mantienen la política.

Los logs del navegador se pierden al cerrar la sesión de depuración si no se exportan. La rotación Docker limita espacio, no garantiza una retención temporal. Logging no reemplaza auditoría, métricas, alertas ni trazas distribuidas. Esas capacidades requieren historias posteriores.

## Verificación

La especificación y evidencias viven en [MAP-189](../../../specs/MAP-189-logging-estructurado/tasks.md). La [guía de logging](../../logging.md) explica el uso y la defensa.
