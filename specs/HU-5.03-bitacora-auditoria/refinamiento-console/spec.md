# SPEC · Auditoría, Métodos de pago y Check-in

Refinar tres pantallas existentes de Console. Auditoría tiene prioridad. Las tres comparten la densidad, tipografía, colores e iconografía de MapIt. La referencia visual está descrita en [diseño](design.md).

## Auditoría

- Dado un administrador del tenant, cuando abre Auditoría, entonces ve el historial de su empresa en una tabla semántica con fecha local, acción, recurso, responsable y cambio. El endpoint vigente opera por tenant y el encabezado comunica ese alcance.
- Dados filtros de período, módulo, acción o UUID exacto del recurso, cuando se aplican, entonces se consulta la API con esos parámetros y se vuelve a la primera página. El intervalo personalizado se conserva como opción avanzada. La paginación y el reintento usan los filtros aplicados. Se muestran carga, vacío y error.
- Dado un evento, cuando se selecciona con teclado o puntero, entonces el panel derecho muestra los datos existentes, transiciones antes/después cuando las hay e identificadores completos bajo un control colapsable. La selección sigue disponible durante la recarga si el evento permanece en el resultado.
- Dados nombres ausentes, entonces se muestra el tipo y el ID abreviado en la tabla. Se puede usar el nombre de la sesión si coincide el ID del actor. El contrato actual admite eventos de reservas y elementos espaciales, y la búsqueda por ID del recurso.

## Métodos de pago

- Dado un establecimiento activo, cuando abre la lista, entonces ve una banda compacta, las vistas de métodos y políticas donde están disponibles, la acción Agregar método y un menú por fila con las acciones admitidas.
- Dados métodos locales, heredados, pasarela y Mock, entonces cada uno conserva sus permisos y estados actuales. El asistente, la edición, la activación, la desactivación, el QR y las políticas siguen usando sus operaciones vigentes.

## Recepción y check-in

- Dado el local activo, cuando abre Check-in, entonces puede elegir Escanear QR o Ingresar código. El escáner arranca mediante una acción explícita, se detiene al salir del modo y muestra los estados de cámara y permisos. Se ofrece selección de cámara cuando hay varias.
- Dado un código o enlace admitido, cuando consulta o escanea, entonces el panel de resultado muestra el comprobante y los datos disponibles de la reserva. Cliente y cantidad de personas dependen del contrato, que actualmente no los devuelve.
- Dada una llegada admitida, cuando se registra, entonces los controles evitan envíos duplicados y reflejan el resultado del servidor. Se mantienen las reglas para códigos inválidos, errores, reservas fuera de estado y operaciones de otro local.

## Alcance y seguridad

Pagos y Check-in siguen el selector global y descartan respuestas obsoletas. Auditoría conserva su ámbito de empresa y su acceso de solo lectura. El JWT, RLS, los contratos, el backend y las rutas de plataforma conservan sus fronteras actuales.

## Segunda iteración visual

- Dadas las nuevas referencias individuales, las tres vistas deben mostrar un encabezado más marcado, usar mejor el ancho disponible y conservar el shell y los tokens de MapIt. Verificar en escritorio y móvil con capturas de la aplicación.
- En Auditoría, el encabezado ocupa el ancho disponible. El detalle comienza junto a los filtros y la tabla. El historial sigue siendo de toda la empresa y la búsqueda por UUID exacto.
- En Métodos de pago, la lista tiene encabezados de método y estado. El panel lateral presenta totales activo/inactivo calculados sobre los métodos visibles. El acceso a políticas aparece según su disponibilidad actual.
- En Check-in, las pestañas y el vídeo pertenecen al panel de consulta, separado del resultado. El vídeo queda libre de esquinas, marco de centrado y línea superpuesta. Se conservan la activación explícita, los estados de cámara y la lectura con el flujo actual.

## Iteración de fidelidad visual · 2026-11-04 (aprobada)

Las tres imágenes del pedido actual son la autoridad de composición: 1 Auditoría, 2 Métodos de pago y 3 Recepción y check-in. No son una propuesta de datos. El usuario aprobó Auditoría a nivel de empresa y comparación visual sin diff numérico al no disponer de originales como archivos. Tras verificar la licencia de PrimeNG 22, aprobó **conservar la tabla nativa**, sustituyendo su elección inicial de `p-table`. Esta iteración sustituye únicamente las decisiones visuales contradictorias anteriores; no reabre backend ni contratos.

- Dadas las referencias, cuando se abren las tres rutas, entonces conservan el shell de staff y reproducen sus encabezados, proporciones, filtros, tablas/listas, paneles y controles usando los tokens existentes. Las medidas y adaptaciones están en los tres documentos de diseño de esta carpeta.
- Dado el contrato de Auditoría, entonces se comunica **historial de la empresa**, no historial exclusivo del establecimiento. El contexto activo puede aparecer solo como referencia explícitamente no filtrante. No se simula búsqueda textual: el UUID exacto conserva su etiqueta y validación; el período, módulo, acción, tamaño de página y navegación consultan realmente la API.
- Dado un evento, entonces la tabla semántica existente muestra las cinco columnas, selección y detalle cerrable con teclado, conservando metadatos e identificadores completos colapsables. No se inventan nombres de recursos, actores, eventos ni transiciones; no hay consultas por fila.
- Dados los métodos del local activo, entonces tabs, lista, resumen derivado, menú CDK, asistente, políticas, QR y reglas de herencia/Mock conservan las operaciones y permisos existentes. No se muestran credenciales ni otro selector de establecimiento.
- Dado Check-in, entonces se reproduce la distribución consulta/resultado y la guía estática de escaneo de la tercera referencia sobre vídeo real. Esta decisión reemplaza la eliminación anterior de la guía; no añade animaciones. Se conservan activación explícita, selección de cámara, permisos, entrada manual, validación, llegada única y limpieza. No se inventan cliente ni cantidad de personas si faltan en la respuesta.
- Dado un cambio de establecimiento en pagos o check-in, entonces desaparecen resultados/borradores ajenos y ninguna respuesta antigua repuebla la vista. Auditoría mantiene el alcance tenant aprobado sin atribuir resultados al local nuevo. `/admin/*`, JWT y RLS no cambian.
- Dados estados no representados (carga, vacío, error, foco y permisos), entonces se reutiliza la semántica existente y se documentan como adaptaciones, no como elementos medidos en las imágenes.
- Dadas las resoluciones 1600 × 900, 1366 × 768, 768 × 1024 y 390 × 844, entonces las tres páginas mantienen orden de lectura, controles accesibles, foco visible y contenido sin desborde del documento. La tabla puede tener desplazamiento horizontal local.
- La aceptación requiere capturas antes/después y revisión visual real, regresión focalizada, lint, typecheck y build. No se declara coincidencia perfecta ni cumplimiento del 2 % sin originales comparables. Las pruebas con respuestas controladas no demuestran autorización del backend ni sustituyen las capturas contra la API real.
