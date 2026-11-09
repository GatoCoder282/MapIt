# Métodos de pago en Console

La pantalla actual combina las configuraciones Mock, el editor y las políticas. Ya lee el establecimiento global en el árbol de trabajo. El rediseño separa la lista y la confirmación del asistente de tres pasos y añade acceso a los tipos que admite el contrato vigente.

## Criterios de aceptación

- Dado un administrador con establecimiento operativo válido, cuando abra la ruta actual, entonces verá su nombre, su dirección si existe y los métodos de ese ámbito. Los valores heredados del tenant se identificarán como tales y serán de solo lectura. La pantalla tendrá estados de carga, vacío, error, falta de permiso y contexto ausente. No habrá controles de selección local.
- Dado un usuario habilitado, cuando agregue un método, entonces avanzará por Tipo de método, Configuración y Revisar y guardar. Podrá volver sin perder el borrador y cancelar con protección ante cambios.
- Dado un QR bancario, cuando complete el formulario, entonces podrá previsualizar, cambiar y quitar su PNG/JPEG. Guardar exigirá los campos del contrato y una imagen válida con Data URL de hasta 350 000 caracteres. El formulario conservará país, moneda, nombre, banco, titular y referencia admitidos. No incluye número de cuenta.
- Dada una pasarela integrada, cuando se configure, entonces solo podrá persistirse inactiva. El backend actual no tiene conexión con proveedores externos ni gestión de credenciales.
- Dado un entorno donde Mock esté habilitado, cuando se cree o edite una configuración de prueba, entonces conservará su API, su QR generado y la regeneración. En producción la opción Mock quedará oculta.
- Dada la revisión, cuando se guarde, entonces la solicitud usará el mismo establecimiento en el que se inició el borrador. Habrá una sola escritura en curso, los fallos dejarán visible el borrador y la confirmación aparecerá con el estado devuelto por el servidor.
- Dado un cambio global de establecimiento, cuando se confirme el descarte, entonces se cerrará el asistente y se recargará la lista. Las respuestas anteriores no actualizarán la pantalla. Se bloqueará la salida durante escrituras. La autorización por tenant, establecimiento y rol seguirá siendo del servidor.
- Dados métodos existentes, cuando el administrador los gestione, entonces podrá consultarlos y realizar las ediciones o cambios de estado que admita el contrato. Se mantendrán las políticas y se identificará el diagnóstico de preparación como específico de Mock.
- Dada la imagen de referencia, cuando se compruebe la consola en escritorio y móvil, entonces las vistas conservarán la jerarquía, el stepper y la estructura documentados en [el diseño local](design.md). Las áreas de administración de plataforma seguirán independientes del contexto operativo.
