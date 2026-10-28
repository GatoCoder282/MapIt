# Descubrimiento Jira — 2026-10-24

Consulta de solo lectura mediante Atlassian MCP. Estado remoto no equivale a implementación local.

| Ticket                                                       | Nombre exacto                                                            | Estado observado |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------- |
| [MAP-240](https://matiasmv2005.atlassian.net/browse/MAP-240) | HU-7.03 — Internacionalización y selección de idioma de la interfaz      | Por hacer        |
| [MAP-239](https://matiasmv2005.atlassian.net/browse/MAP-239) | HU-7.02 — Configuración y validación de las cuatro verticales operativas | Por hacer        |
| [MAP-231](https://matiasmv2005.atlassian.net/browse/MAP-231) | HU-7.01 — Configuración de Vertical                                      | Por hacer        |
| [MAP-229](https://matiasmv2005.atlassian.net/browse/MAP-229) | HU-6.03 — Integración de Pago QR                                         | En curso         |
| [MAP-228](https://matiasmv2005.atlassian.net/browse/MAP-228) | HU-6.02 — Autogestión de Reserva                                         | En curso         |
| [MAP-227](https://matiasmv2005.atlassian.net/browse/MAP-227) | HU-6.01 — Buscador de Disponibilidad                                     | Listo            |
| [MAP-194](https://matiasmv2005.atlassian.net/browse/MAP-194) | HU-5.03 — Bitácora de Auditoría                                          | En curso         |
| [MAP-193](https://matiasmv2005.atlassian.net/browse/MAP-193) | HU-5.02 — Flujo de Estados de Reserva                                    | Listo            |
| [MAP-192](https://matiasmv2005.atlassian.net/browse/MAP-192) | HU-5.01 — Creación de Reserva Interna                                    | Listo            |
| [MAP-145](https://matiasmv2005.atlassian.net/browse/MAP-145) | HU-3.02 — Visualización en Tiempo Real                                   | Listo            |
| [MAP-103](https://matiasmv2005.atlassian.net/browse/MAP-103) | HUT-01 — Implementación de Infraestructura WebSocket                     | Listo            |

MAP-229 bloqueada por MAP-228 mediante enlace Blocks. MAP-228 depende de MAP-227 y MAP-192; bloquea MAP-229 y MAP-230. MAP-145 depende de MAP-103 y de infraestructura relacionada.

Los criterios originales MAP-229 son QR de reserva, webhook autenticado e idempotente, confirmación válida, UI realtime existente y E2E mock. Configuración internacional, comprobantes y check-in son ampliaciones solicitadas por el usuario; se propone separarlas en tres historias, sin modificar Jira.

Contraste local: MAP-228 carece de creación pública/credencial; MAP-193 solo dispone de enum y creación/listado; MAP-194 solo tiene auditoría operativa especializada. No se altera el estado de estos tickets ni se afirma su cumplimiento.
