# Selector de establecimiento — Accesibilidad y comportamiento

> Especificación local de la superficie modal. Ver [design.md](design.md) para valores visuales y [design-components.md](design-components.md) para componentes.

## Modal obligatorio

- Usar `<dialog>` nativo con `showModal()`, nombre accesible asociado al título y descripción de apoyo cuando proceda. La modalidad nativa retiene el foco dentro y hace inerte el contenido exterior mientras permanece abierto.
- La selección inicial no incluye botón de cerrar ni omisión. En una reapertura explícita, mostrar la X solo si el establecimiento previo fue revalidado en la lista autorizada actual; Escape puede cerrar únicamente en ese mismo caso. Nunca cerrar por clic en el backdrop. Si no existe selección previa validada, el modal sigue siendo obligatorio y “Cerrar sesión” es la salida segura.
- Al abrir, llevar el foco a un encabezado enfocable o a la primera opción de la lista; al cerrar por elección válida, restaurar foco al invocador disponible. Probar foco al cargar y tras error.
- El modal cubre la aplicación; no añadir `inert` manual duplicado a la shell cuando `<dialog>` modal nativo ya gestiona la modalidad.

### Apertura explícita desde Negocios

`/establishments` sustituye la antigua pantalla de gestión por un acceso a `/home?selectEstablishment=1`. Ese estado abre el mismo diálogo aun con una preferencia válida, refresca los establecimientos autorizados y vuelve a `/home` al confirmar. No cambia la composición, tokens ni permisos. La entrada normal conserva la restauración sin modal y las URLs profundas tras la selección obligatoria.

## Teclado y lector de pantalla

| Entrada                    | Comportamiento esperado                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `Tab` / `Shift+Tab`        | Recorrido cíclico por radios, Continuar y salida segura; nunca foco detrás del diálogo.                                          |
| Flechas en grupo de radios | Cambiar opción según semántica nativa del grupo.                                                                                 |
| `Espacio`                  | Seleccionar la opción enfocada.                                                                                                  |
| `Enter`                    | Activar Continuar si hay selección válida.                                                                                       |
| `Escape`                   | Bloqueado en la selección inicial o sin selección previa validada; en reapertura validada, restaura el establecimiento anterior. |

- Representar opciones como `fieldset`/`legend` o grupo de radios nativo equivalente; cada opción tiene nombre accesible que incluya establecimiento y dirección disponible.
- El estado seleccionado se expresa con radio nativo (`checked`) y tratamiento visual; nunca solo con color.
- Marcar insignias, adornos, miniaturas decorativas y flecha ornamental como `aria-hidden="true"`. Si la miniatura transmite identidad, es genérica y repetida; no debe anunciar información inexistente.
- Error y carga se anuncian sin desplazar el foco inesperadamente; usar estado vivo apropiado y no anunciar repetidamente actualizaciones cosméticas.
- El contenido en azul debe cumplir WCAG AA para texto normal (4.5:1) en cada zona del degradado. Si no se alcanza, ajustar la capa/superposición o el color del texto, sin degradar legibilidad.
- Foco visible con contorno de al menos 2 px y separación; usar el token de foco azul cuando contraste con la superficie. Comprobar foco sobre la tarjeta y el CTA.
- Mantener objetivos interactivos cómodos (mínimo recomendado 44 × 44 CSS px); CTA de altura utilizable en móvil.

## Persistencia y confianza

Puede recordarse la última elección en almacenamiento local **solo bajo una clave compuesta por tenant y usuario**. No tratar el valor recordado como autorización: validarlo con el servidor y confirmar que sigue entre los establecimientos accesibles antes de restaurar selección o continuar. Si no puede validarse, no restaurar una elección activa; mostrar el selector y requerir selección. No guardar datos de otro tenant/usuario bajo una clave compartida.

La lista y la decisión de acceso proceden del endpoint accesible. No inferir permisos, tipo o ubicación a partir de la elección recordada.

## Estados funcionales (no mostrados en la referencia)

Estos son requisitos de comportamiento aprobados, pero son propuestas de presentación porque la imagen no ilustra dichos estados:

| Estado         | Presentación propuesta                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cargando       | Mantener la composición del modal; mostrar indicador/placeholder en el área de opciones y texto de carga accesible. Deshabilitar Continuar.       |
| Error          | Mantener modal y shell; presentar mensaje claro y acción “Reintentar”. Ofrecer “Cerrar sesión” como salida segura; no cerrar modal al fallar.     |
| Vacío          | Mensaje de lista vacía, Continuar deshabilitado y acción “Cerrar sesión”. No inventar un paso de creación ni una ruta para saltarse la selección. |
| Datos cargados | Habilitar Continuar solo tras selección válida y validada. Dirección nullable usa “Sin dirección registrada”.                                     |

Reutilizar los textos existentes en `strings.establishmentContext` cuando encajen (`loading`, `empty`, `error`, `retry`, `continue`, `addressMissing`, `logout`). La salida segura no es un “skip”: termina la sesión y no entra a un establecimiento.

## Responsive

Propuesta pendiente de validación visual en dispositivos — la referencia solo especifica escritorio:

- En anchos que no permitan conservar paneles con contenido legible, reorganizar como una columna: encabezado de marca compacto arriba, opciones apiladas y CTA visible al final; no comprimir tipografía para forzar la división 36/64.
- En alturas reducidas, permitir desplazamiento dentro del diálogo y mantener Continuar/salida segura alcanzables; evitar cortar título o radios por el teclado virtual.
- Respetar safe areas en móvil y no exceder el viewport: `max-height` ligado al viewport dinámico, con contenido desplazable.
- El panel editorial se puede compactar visualmente, pero conservar el propósito y la identificación accesibles del diálogo.
- Probar orientación vertical/horizontal, zoom de 200%, teclado, lector de pantalla y `prefers-reduced-motion`.

## Contenido

- Mantener el voseo y copy aprobado: “Seleccioná tu establecimiento”, “¿Con cuál establecimiento querés entrar?” y “Continuar”.
- Mostrar nombre y dirección; nunca generar tipo de local ni fotografía específica. La categoría está ausente del contrato de datos.
- No incluir búsqueda ni cierre/skip en esta versión: no los pide la referencia aprobada.
