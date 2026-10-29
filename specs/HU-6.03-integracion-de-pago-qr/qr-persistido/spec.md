# Configuración QR MOCK persistida

La nueva petición autoriza frontend, backend, OpenAPI y migraciones. Sustituye la prueba local anterior por configuración permanente de desarrollo, sin activar pagos ni conectarse a bancos.

## Criterios de aceptación

- Dado un administrador autenticado, cuando busca establecimiento, el selector muestra únicamente locales accesibles de su tenant, con nombre y dirección disponible, y guarda el UUID seleccionado.
- Dado el catálogo internacional ISO 3166-1 alpha-2, cuando busca por nombre o código, puede seleccionar el país y guardar su código.
- Dado un país, cuando configura banco, puede escribir uno o elegir entre nombres previamente usados por su tenant para ese país. Banco, titular y referencia son obligatorios y se presentan como datos de prueba.
- Dada la configuración, cuando genera un QR, se muestra una imagen decodificable con URL de MapIt y token aleatorio, sin banco, titular ni cuenta en el contenido. Siempre se identifica como «QR de prueba — No procesa dinero real».
- Dada una configuración guardada, cuando recarga, edita, cambia estado o regenera, los cambios persisten en PostgreSQL. Hay como máximo una configuración por tenant y establecimiento.
- Dada una URL del QR, cuando se abre, muestra únicamente una pantalla de simulación, sin crear intentos, confirmar pagos ni mostrar datos bancarios.
- Dado otro tenant o un UUID de establecimiento ajeno, cuando intenta leer o modificar la configuración, se rechaza la operación. El tenant proviene exclusivamente del JWT.
- Dado producción o un entorno sin habilitación explícita de MOCK, la API de configuración no está disponible.
- Dado un error de catálogo, generación o guardado, la pantalla lo explica y permite recuperarse conservando el formulario cuando procede.
- Dado un selector de establecimiento o país, cuando se abre o se escribe, una única caja combinada muestra y filtra sus opciones. Ratón, táctil y teclado confirman una opción del catálogo; el texto libre nunca se guarda como identificador.

## Límites

No se añaden cobros, conexiones bancarias, confirmaciones financieras, checkout ni comprobantes reales. No se restaura el selector global de establecimiento. El catálogo de bancos se basa en configuraciones del tenant; no pretende ser un directorio bancario mundial.

## 9. Aislamiento de datos

Nueva tabla de configuración específica de MOCK, separada de métodos consumidos por checkout: tenant_id NOT NULL, índice (tenant_id,id), claves foráneas compuestas al establecimiento/actores, unicidad (tenant_id,establishment_id), RLS forzada y filtros explícitos. El token del QR solo identifica una URL de demostración; no autoriza acceso a registros.
