# Plan

1. Contrato primero: recurso ADMIN /payment-methods/mock-qr con listado/alta, consulta/edición, regeneración y catálogo de países. Reutilizar /establishments/accessible para locales reales.
2. Regenerar cliente OpenAPI antes de implementar sus consumidores.
3. Agregado específico MockQrConfiguration, puerto de repositorio, servicio de aplicación y adaptador JDBC/controlador en payments. Migración nueva, sin editar V20–V23. Reutilizar MockPaymentSettings para bloqueo de entorno y habilitación explícita.
4. Formulario signals MVVM con una caja combinada por catálogo: un campo abre el desplegable y filtra nombre, dirección o código. El componente presentacional comparte teclado, foco y búsqueda entre ambos selectores; el store verifica pertenencia al catálogo antes de guardar UUID e ISO mediante el cliente generado. Sugerencias de bancos por país desde el listado del tenant. Se reutiliza qrcode 1.5.4, ya presente en public-web. Backend guarda token/ruta de simulación; la imagen es derivada y se reconstruye al recargar, solo para configuraciones guardadas.
5. Pantalla de simulación pública en `public-web` (`/simulacion/qr/:token`): estática, sin llamadas a la API, sin datos bancarios y sin efectos financieros.
6. Verificar unidad, contrato, persistencia real, RLS, aislamiento, producción y UI en escritorio/móvil. Cada agente limita sus cambios a los archivos asignados.

## Patrones de diseño aplicados

| Patrón                               | Por qué aquí                                                                                                     | Alternativa descartada                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Hexagonal con puerto JDBC            | Mantener dominio sin Spring y comprobar aislamiento en adaptador                                                 | SQL o HTTP desde el dominio                              |
| Agregado de configuración separado   | No introducir QR de demostración en checkout existente                                                           | Reutilizar MOCK_GATEWAY que permite iniciar intentos     |
| MVVM con signals                     | Formularios, solicitudes cancelables y estados verificables                                                      | Persistencia local o lógica de API en plantilla          |
| Derivación de vista (QR desde token) | La imagen se reconstruye desde `simulationPath`; no se persiste el PNG ni viaja banco, titular o cuenta en el QR | Guardar la imagen o meter datos de la cuenta en el token |

API: GET/POST /payment-methods/mock-qr; GET/PUT /payment-methods/mock-qr/{configurationId}; POST /payment-methods/mock-qr/{configurationId}/regenerate; GET /payment-methods/mock-qr/countries. Write: establishmentId, country, bankName, accountHolderName, accountReference, enabled. Response: añade id, simulationToken, simulationPath, createdAt y updatedAt. País: code/name.
