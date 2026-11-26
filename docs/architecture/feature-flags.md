# Feature flags de MapIt

Usamos Unleash para desplegar una capacidad progresivamente, aislar un fallo operativo
con una alternativa disponible o habilitar una vertical por tenant. Las flags que
solo cambian la consola no sustituyen las comprobaciones de autorización del backend.

| Flag                                     | Qué controla hoy                                         | Qué pasa al apagarla                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `operations.space-monitor`               | Entrada al monitor espacial de la consola                | Los accesos al monitor desaparecen y una nueva navegación vuelve a Inicio. Inicio conserva las reservas; el editor sigue sujeto a su propia flag y rol. |
| `check-in.camera`                        | Escaneo con cámara en recepción                          | Se detiene el escáner y queda disponible el formulario manual con el código escrito. La consulta y el registro usan los mismos permisos de siempre.     |
| `map-editor.enabled`                     | Entrada al editor de pisos y sectores                    | Mapa ofrece el monitor si está habilitado. El guard bloquea nuevas entradas al editor sin forzar la salida de sesiones abiertas.                        |
| `realtime.websocket`                     | Transporte en vivo por WebSocket/STOMP                   | El monitor usa consultas HTTP periódicas. Separar transporte de monitor permite mantener la vista durante una incidencia de WebSocket.                  |
| `spaces.floors` y `spaces.sectors`       | Rutas y vistas de gestión de pisos y sectores en consola | Se restringe la navegación correspondiente. Las APIs siguen aplicando sus propias reglas.                                                               |
| `vertical.hotel` y `vertical.event-hall` | Disponibilidad de verticales por tenant                  | El backend aplica el gate de vertical al crear establecimientos o nuevas reservas.                                                                      |
| `payments.qr`                            | Aviso de pagos QR en Inicio                              | Cambia el texto del panel. El checkout público y los endpoints de pago no consultan esta flag.                                                          |
| `demo.hello`                             | Clave de diagnóstico                                     | No hay banner activo que dependa de ella.                                                                                                               |
| `spaces.editor-grouping`                 | Clave reservada para agrupación                          | No hay un consumidor activo.                                                                                                                            |

Un corte de checkout QR debe ampliar `payments.qr` en el punto donde se inicia un
pago. Antes hay que definir qué pasa con los intentos en curso, webhooks y recibos.
No se justifica otra flag para el mismo pago. Los flujos base de login, permisos,
establecimientos y reservas manuales siguen disponibles sin nuevos toggles. Las
plantillas son parte del editor y la vista de planta ya descartó su toggle separado.

En desarrollo, con Unleash levantado, ejecuta `pnpm db:seed:flags`. El script crea
las claves faltantes de `flags.json` e inicializa las nuevas en el entorno configurado
(`development` por defecto). Conserva el estado y las estrategias de las que ya
existen. Si la creación funciona pero falla la activación, el comando indica qué
flag completar desde Unleash. En staging y producción, registra y configura una
flag antes de desplegar su consumidor. Cuando el proxy responde correctamente, una
flag ausente se evalúa como apagada.
