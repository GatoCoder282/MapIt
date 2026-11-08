# Tareas

- [x] Investigar el módulo y los contratos existentes.
- [x] Identificar componentes y tokens reutilizables.
- [x] Integrar el catálogo real con el contexto y la invalidación de lecturas/escrituras.
- [x] Presentar lista y políticas en vistas separadas dentro del módulo.
- [x] Implementar los tres pasos con QR, pasarela inactiva y Mock condicionado.
- [x] Conservar consulta, edición, activación, desactivación y regeneración donde el contrato lo admite.
- [x] Probar formularios, navegación, doble envío, errores, permisos y cambios de ámbito en pruebas de unidad y de componente.
- [x] Ejecutar lint, tests, build y verificación de `/admin/settings` sin contexto operativo.
- [x] Capturar vistas de la aplicación y comparar con la referencia.

## Notas de ejecución

- El formulario Mock no es el alta de QR bancario. El QR bancario usa el catálogo de métodos y requiere imagen incluso si queda inactivo.
- El catálogo puede devolver métodos generales heredados. El módulo identificará su origen y evitará escrituras sobre esos valores.
- El movimiento aprobado usa transiciones CSS de opacidad y transformación para pasos, selección y éxito. La preferencia de movimiento reducido las desactiva.
- `pnpm fe:lint` pasó. `pnpm fe:test` pasó con 361 pruebas de Console, 122 de Public Web y 81 de librerías. `pnpm fe:build` generó ambas aplicaciones con avisos de presupuesto y dependencias CommonJS.
- Las pruebas live necesitan Docker y el stack de MapIt. El daemon local de Docker no estaba disponible para esta ejecución.
- Playwright ejecutó el bundle de producción con respuestas controladas. Verificó la carga de PNG, un único POST en el alta, el cambio de establecimiento tras confirmar el descarte, la entrada sin contexto y el acceso a `/admin/settings`. Se capturaron las cinco vistas, la variante pasarela y el diseño móvil. Chromium calculó 150 ms para la marca de selección y 0 ms con movimiento reducido.
- El montaje original no tiene la escala, el shell ni los datos de la consola. Al normalizar cada panel a 160 × 100 px y contar diferencias mayores que 32 por canal, cambiaron 21,87 % en lista, 20,12 % en tipo, 25,01 % en QR, 25,47 % en revisión y 16,18 % en confirmación. La comparación confirma que los paneles difieren del montaje y no cumple el umbral de 2 %. Se conservaron el shell y los tokens de la consola, los campos reales del contrato y la vista previa QR en revisión.
