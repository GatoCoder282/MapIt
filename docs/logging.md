# Logging de MapIt — MAP-189

El objetivo es responder **qué ocurrió, en qué operación, con qué resultado y dónde falló**, sin reconstruirlo a partir de mensajes sueltos ni exponer datos del cliente.

## Cómo funciona

```mermaid
sequenceDiagram
  participant UI as Angular
  participant API as Backend HTTP
  participant DB as Outbox
  participant Job as Dispatcher
  UI->>API: Petición + X-Request-ID
  Note over API: Validar UUID; autenticar; establecer contexto
  API->>DB: Persistir evento con event_id
  Note over API: Log con request_id y event_id
  API-->>UI: Respuesta + X-Request-ID
  Note over UI: Log seguro del resultado
  Note over API: Resumen HTTP y limpieza del contexto
  Job->>DB: Reclamar evento pendiente
  Note over Job: Tenant interno + event_id + intento
  Job->>Job: Publicar o programar reintento
```

**SLF4J** es la API que usa el código Java. **Logback** procesa los eventos. **Spring Boot** configura su salida JSON. Elegir el formato `logstash` no instala ni necesita un servidor Logstash: es el nombre del formato.

**MDC** es el contexto asociado al hilo de ejecución: adjunta request_id y, después de autenticar, tenant_id. No es almacenamiento de sesión ni autorización. Se restaura en finally para que una ejecución posterior no herede datos. Tampoco cruza automáticamente hacia tareas programadas: el dispatcher crea su propio contexto y usa event_id.

**X-Request-ID** es un UUID canónico (8-4-4-4-12 hexadecimales). Un cliente puede enviarlo; el servidor lo normaliza a minúsculas. Si falta o es inválido, genera otro sin rechazar la petición. Se devuelve también en errores. No es un secreto ni una prueba de identidad: un cliente puede repetirlo. Para investigar, combinarlo con fecha, servicio y contexto verificado.

## Formato y niveles

Ejemplo ficticio de resumen HTTP:

```json
{
  "@timestamp": "2026-10-06T14:00:00Z",
  "service": "mapit-backend",
  "environment": "development",
  "level": "WARN",
  "event": "http.request.completed",
  "request_id": "c4972182-5fa3-4630-8de7-f11a409ee314",
  "method": "POST",
  "route": "/api/v1/auth/login",
  "status": 401,
  "duration_ms": 18
}
```

Los campos cambian según el evento. No se inventa tenant_id para una petición sin identidad válida. El JSON real puede incluir campos técnicos adicionales de Boot (logger, hilo). Nginx usa categorías como `static_asset` y duración en segundos; la aplicación usa `duration_ms`.

| Nivel | Uso                                            | Ejemplo                                      |
| ----- | ---------------------------------------------- | -------------------------------------------- |
| INFO  | Operación habitual o recuperación              | Petición completada, integración recuperada  |
| WARN  | Rechazo de seguridad o degradación recuperable | JWT rechazado, reintento de publicación      |
| ERROR | Fallo técnico inesperado                       | Excepción no manejada, fallo de red frontend |
| DEBUG | Detalle de diagnóstico                         | Validación esperada, sondeo sin trabajo      |

No todos los 4xx son fallos técnicos. Los 401/403 ayudan a diagnosticar seguridad; una validación esperada normalmente no necesita stack trace. Un resumen HTTP y un evento de integración son distintos; repetir la misma excepción en controlador, servicio y adaptador no aporta información.

Backend: `LOG_LEVEL` y `MAPIT_LOG_LEVEL` controlan los niveles, con INFO por defecto; `APP_ENV` etiqueta el entorno. El nivel no concede permiso para registrar secretos. Evitar activar TRACE/DEBUG indiscriminadamente en clientes HTTP o SQL.

## Privacidad y nuevo código

1. Elegir un evento estable y un mensaje controlado; no concatenar datos del usuario.
2. Adjuntar únicamente campos permitidos: identificadores técnicos, estado, duración, intento y operación conocida.
3. Registrar el fallo en el límite que lo maneja. Si se propaga para que lo gestione otro límite, no repetir la excepción.
4. Usar SLF4J en infraestructura y @mapit/logging en Angular. El dominio permanece libre de mecanismos de logging.
5. Añadir una prueba con datos señuelo cuando aparezca un nuevo campo o integración.

Ejemplo Java en un adaptador (logger estático creado con `LoggerFactory.getLogger`):

```java
log.atWarn()
    .addKeyValue("event", "integration.failed")
    .addKeyValue("integration", "smtp")
    .addKeyValue("error_type", exception.getClass().getName())
    .log("Invitation delivery failed");
```

Ejemplo Angular (el proveedor de la app fija servicio y nivel):

```typescript
import { inject } from '@angular/core';
import { Logger } from '@mapit/logging';

private readonly logger = inject(Logger);
// En el límite que gestiona el fallback:
this.logger.log('WARN', 'config.fallback');
```

Los nuevos eventos frontend se añaden al catálogo tipado de `libs/logging/src/catalog.ts`. Para permitir un campo nuevo, actualizar también el serializador y su prueba de privacidad; una aserción de tipos por sí sola no protege los datos en runtime.

Nunca adjuntar Authorization, Cookie, contraseñas, JWT, URL de activación, email, body HTTP, frames STOMP completos, entidades ni configuración. Un objeto Error o Throwable puede contener esos datos en su mensaje o causa. Se conserva la ubicación del fallo y su tipo, pero se omite texto arbitrario.

En Angular, el adaptador compartido es el único punto que usa console. El interceptor solo interviene en la API configurada; no envía X-Request-ID a recursos estáticos, Unleash ni terceros. El ErrorHandler conserva los listeners globales existentes, y los fallos de arranque utilizan el mismo mecanismo seguro antes de disponer de inyección de dependencias.

Nginx no registra URLs, referers ni IPs. Su error_log por petición está desactivado porque incorpora URLs sin un mecanismo de redacción. Los fallos HTTP siguen visibles con estado y categoría en access_log; los errores de configuración/arranque permanecen en stderr. Esta decisión evita que un enlace de activación termine en un log por solicitar un recurso inexistente.

## Consultar y verificar

Con Docker disponible y el entorno configurado:

```powershell
pnpm infra:full
pnpm logging:smoke
docker logs --since 5m mapit-backend
docker logs --since 5m mapit-console
```

Filtrar por un ID observado en Network → Response Headers:

```powershell
docker logs --since 5m mapit-backend 2>&1 | Select-String 'c4972182-5fa3-4630-8de7-f11a409ee314'
```

En DevTools → Console, los eventos propios de MapIt son líneas JSON. Filtrar por request_id; errores internos del navegador (por ejemplo CORS) pueden aparecer además y no pertenecen al logger de la aplicación.

`pnpm logging:smoke` envía un token y una URL señuelo al stack local, comprueba correlación del 401 y sustitución de IDs inválidos, analiza stdout real de backend/Nginx y verifica la rotación. No imprime los contenidos de los logs ni utiliza credenciales reales.

```powershell
pnpm be:test
pnpm be:it
pnpm fe:test
pnpm e2e --project=console logging.spec.ts
pnpm check
```

El E2E necesita las aplicaciones y el backend levantados. Las pruebas de integración requieren Docker. Las evidencias reales, incluidas limitaciones del entorno, se registran en [tasks.md](../specs/MAP-189-logging-estructurado/tasks.md); una prueba escrita no equivale a una prueba ejecutada.

## Defensa del martes 6 de octubre de 2026

Guion de 8–10 minutos:

1. **Problema (1 min):** antes había mensajes aislados y reintentos sin trazabilidad. Mostrar el estado inicial descrito en el ADR.
2. **Arquitectura (2 min):** explicar SLF4J → Logback → JSON y el adaptador Angular. Recorrer el diagrama: petición, outbox y dispatcher.
3. **Demostración HTTP (2 min):** iniciar sesión con datos ficticios inválidos. Mostrar el 401, su X-Request-ID, el JSON del navegador y la búsqueda del mismo ID en backend.
4. **Integración (1 min):** ejecutar/mostrar la prueba de fallo y reintento del outbox con un broker simulado. Identificar event_id e intento. No añadir endpoints de fallos al producto.
5. **Privacidad y pruebas (2 min):** mostrar las aserciones de secretos señuelo y ejecutar logging:smoke. Explicar aislamiento entre tenants y limpieza del MDC.
6. **Límites (1 min):** el navegador no envía logs a un servidor; Docker limita espacio, no días. Actuator aporta salud/métricas, pero no hay plataforma de alertas ni trazas distribuidas en este ticket.

Preguntas probables:

| Pregunta                                                     | Respuesta                                                                                                            |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| ¿Por qué JSON?                                               | Los campos se pueden filtrar y validar automáticamente sin interpretar una frase.                                    |
| ¿Por qué no crear un logger Java desde cero?                 | SLF4J y Boot ya resuelven niveles y serialización; nuestro código añade contexto y política de privacidad.           |
| ¿El request_id identifica al usuario?                        | No. La identidad viene de un JWT verificado; el ID solo correlaciona diagnóstico.                                    |
| ¿Cómo se sigue un reintento después de terminar la petición? | El log de encolado enlaza request_id con event_id; el dispatcher usa el event_id persistido.                         |
| ¿Por qué no guardar todos los mensajes de excepción?         | Pueden contener secretos y datos SQL. Conservamos tipos y ubicaciones y añadimos motivos controlados.                |
| ¿Los logs son una auditoría?                                 | No garantizan inmutabilidad ni retención de negocio. La bitácora del dominio tiene otro propósito.                   |
| ¿Por qué no hay Elasticsearch o Grafana?                     | Son un siguiente alcance: ingesta, permisos, retención, operación y alertas. El JSON deja preparada esa integración. |
| ¿Cómo se demuestra que funciona?                             | Tests sobre JSON real, aislamiento, canarios de privacidad, flujo E2E y smoke de los contenedores.                   |

Referencias: [logging de Spring Boot](https://docs.spring.io/spring-boot/reference/features/logging.html), [API fluida SLF4J](https://www.slf4j.org/manual.html), [manejo de errores Angular](https://angular.dev/best-practices/error-handling), [ADR-0010](architecture/adr/ADR-0010-logging-estructurado.md).
