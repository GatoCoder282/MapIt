# Tareas

- [x] Comprobar el contrato, la política temporal y los componentes disponibles.
- [x] Extender OpenAPI y persistir notas con una columna opcional.
- [x] Implementar creación para la mesa seleccionada y estados de disponibilidad.
- [x] Adaptar el panel a la referencia en escritorio y móvil.
- [x] Verificar el alta con API real y el proceso de validación.
- [x] Retirar la página de alta interna y dirigir todos sus accesos al mapa.

## Notas de ejecución

- Se conserva la política actual de 90 minutos y la preparación de 15 minutos.
- La comprobación usa el estado de la mesa y las reservas existentes. El servicio vuelve a verificar el intervalo al confirmar.
- La migración V37 agrega notas opcionales de hasta 1000 caracteres al contrato interno.
- Pasaron 16 pruebas focalizadas de la consola, 69 pruebas de reservas y 16 de integración HTTP.
- Playwright confirmó alta real, notas recuperables, solapamiento rechazado y estado operativo disponible para la reserva futura.
- La suite general de backend registró un fallo de ArchUnit en las dependencias entre pruebas de identity y platform.
- Pasaron 44 pruebas focalizadas de consola y los escenarios de Playwright de monitoreo y Reserva rápida. Cubren el enlace anterior, las alternativas con horario precargado y el guardado desde el mapa.
