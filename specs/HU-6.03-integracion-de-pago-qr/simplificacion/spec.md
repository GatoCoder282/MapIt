# Simplificación de configuración de pagos

Alcance autorizado por la petición del usuario: quitar la selección inicial y el cambio global de establecimiento, la barra de establecimiento y la navegación duplicada. Reducir métodos de pago a configuración MOCK para desarrollo, sin datos bancarios ni operaciones financieras nuevas.

## Criterios de aceptación

- Dado un usuario autenticado, cuando entra a la consola, entonces accede directamente a Inicio sin elegir establecimiento.
- Dada la navegación de staff, cuando abre Configuración, entonces encuentra un único grupo con plantillas, reservas y métodos de pago según su rol.
- Dado un administrador, cuando configura un método, entonces solo indica nombre, país, moneda y estado para MOCK; la empresa viene del JWT.
- Dado un método MOCK, cuando guarda o cambia su estado, entonces se persiste mediante los endpoints existentes y vuelve al listado.
- Dado un entorno distinto de dev/test, cuando intenta configurar MOCK, entonces el frontend bloquea la pantalla y conserva el bloqueo de activación del backend existente.
- Dado el flujo eliminado, cuando se ejecutan las pruebas, entonces no quedan expectativas del selector o del cambio global de establecimiento.

Fuera de alcance: nuevas migraciones, proveedores reales, checkout, transacciones, comprobantes, nuevas funciones de check-in y wizard de tres pasos. Se prioriza la solicitud de simplificación sobre la propuesta extensa del documento adjunto. La descripción opcional queda pendiente porque el contrato actual no la contempla.
