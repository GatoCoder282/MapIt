# Prompt del agente — Proyecto MapIt

## Contexto fijo del proyecto

Monorepo pnpm. Frontend Angular en `apps/console`. Backend Kotlin/Java en `apps/backend` — **no lo toques bajo ninguna circunstancia**, ni siquiera para "arreglar" algo relacionado.

### Librerías de frontend ya decididas y aprobadas

No instales otras sin preguntar primero y justificar por qué estas no alcanzan.

| Librería                      | Uso                                                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@angular/animations`         | Transiciones simples de UI (hover, estado, entrada/salida)                                                                   |
| GSAP + ScrollTrigger          | Animaciones complejas, scroll-driven                                                                                         |
| Lenis                         | Solo si la referencia visual pide scroll cinematográfico explícito                                                           |
| spartan/ui (`@spartan-ng`)    | Solo si falta una primitiva headless que el HTML/imagen no resuelve por sí sola                                              |
| `@playwright/test`            | Verificación visual (ver flujo de recreación abajo)                                                                          |
| `@lucide/angular`             | Librería de iconos — variedad, consistencia de stroke/grid, personalizable con tokens de `DESIGN.md` (color, tamaño, grosor) |
| `@ng-icons/core`              | Respaldo de iconos — solo si Lucide no cubre un icono necesario (ver "Estrategia de iconos" abajo)                           |
| `primeng` (+ tema vía tokens) | Solo para dashboards/pantallas de datos: `p-table`, selects, date pickers, paginador, filtros. NO para UI general de la app  |
| `echarts` + `ngx-echarts`     | Gráficos de dashboards (barras, líneas, heatmaps, gauges, treemaps). Import por módulos (tree-shaking), con tema propio      |
| `ag-grid-angular` (Community) | Respaldo condicional de tabla: solo si `p-table` no alcanza (ver "Flujo especial — Dashboards")                              |

### Documentos vivos de referencia

Actualízalos cuando yo apruebe un cambio que los contradiga — nunca los sobrescribas en silencio, **excepto** la excepción de paleta de color detallada en la Regla 3 más abajo.

- `DESIGN.md` / `design-guidelines.md` / `design-components.md` → tokens, specs de componente, jerarquía. Fuente única de verdad para valores de diseño.
- `PRODUCT.md` → a quién sirve el producto, tono, audiencia.

---

## Skills (agente: OpenCode, en `.agents/skills`)

Activa según el tipo de tarea, no todas a la vez.

### Estado de instalación (verificado contra la carpeta `.agents/skills`)

Carpetas presentes: `animate`, `animate-expo`, `animation-vocabulary`, `apple-design`, `ask-sonner`, `design-system`, `emil-design-eng`, `extract-design-system`, `find-animation-opportunities`, `imagegen-frontend-web`, `impeccable`, `improve-animations`, `pick-ui-library`, `prototype`, `review-animations`, `web-design-guidelines`, `write-swift`.

**Pendiente de instalar:** `design-taste-frontend` (no aparece en la carpeta).

- Si `design-taste-frontend` no está en `.agents/skills` cuando un ítem del checklist la requiera, **dilo explícitamente y no simules su comportamiento** con criterio propio (Regla 4). Preséntame el comando de instalación y espera.
- Comando de instalación (solo esta skill, no el bundle completo):
  `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"`
- Tras instalar: fijar el commit instalado y registrar en `DESIGN.md` los valores de sus tres dials (ver "Precedencia"). Confirmar los nombres exactos de los dials leyendo su `SKILL.md`.
- **No instalar** `stitch-design-taste` ni otras variantes de taste: compiten con `DESIGN.md` (exporta su propio formato) y apilar variantes produce directivas contradictorias.
- Si la v2 (experimental, la que instala por defecto) rompe el flujo, bajar a `design-taste-frontend-v1`.

### Del paquete `emilkowalski/skills` (motion + design engineering)

- `find-animation-opportunities` → decide SI algo debería animarse y qué NO animar. **Es la autoridad para esta decisión — no la sustituyas por criterio propio.**
- `animate` → construye una animación desde cero (curva, duración, propiedades, entrada/salida) una vez decidido que sí vale la pena.
- `animation-vocabulary` → traduce una petición vaga de motion ("que se sienta más fluido") a términos precisos, antes de invocar `animate`.
- `review-animations` → audita el motion de un archivo/componente puntual con reglas estrictas.
- `improve-animations` → audita el motion de **todo el codebase** y devuelve un plan priorizado — úsala para pasadas globales, no por archivo.
- `pick-ui-library` → elige la librería correcta para una necesidad de UI (toasts, OTP, charts, drag&drop, virtualización, command menus) de una lista curada y confiable. **Consúltala primero** cuando se necesite una capacidad nueva, antes de preguntarme a mí o de que el agente decida por su cuenta. (Excepción: dashboards, tablas y gráficos ya están resueltos en "Flujo especial — Dashboards".)
- `emil-design-eng` → skill general de diseño/motion, úsala solo si ninguna de las anteriores, más específicas, cubre el caso.
- `apple-design` → principios de Apple/WWDC para web. **Opt-in explícito únicamente** — tu Figma ya define la estética del proyecto; no debe activarse automáticamente ni competir con `DESIGN.md`.
- `prototype` → genera varias versiones de una UI para elegir visualmente. Solo se invoca a pedido explícito, nunca automático.
- `animate-expo`, `ask-sonner`, `write-swift` → **instaladas pero no aplican a este proyecto** (Expo/React Native, toast de React, y Swift/iOS respectivamente — nada de esto existe en el stack Angular + Kotlin/Java de MapIt). No las actives en ningún flujo.

### Externas

- `design-system` (`albertzhangz10/design-system-skill`) → convertir una imagen/screenshot en `design.md` / `design-guidelines.md` / `design-components.md` **antes** de implementar.
- `extract-design-system` (`arvindrk`) → consistencia de tokens entre múltiples páginas/componentes.
- `impeccable` (`pbakaus`) → auditar/mejorar diseño ya existente (layout, tipografía, jerarquía, anti-slop).
- `design-taste-frontend` (`Leonxlnx/taste-skill`, v2 experimental) → dirección visual anti-slop (layout, tipografía, ritmo) cuando NO hay spec en `DESIGN.md` ni imagen de referencia, y preflight anti-genérico al cerrar una tarea que creó UI nueva. **Subordinada** a las demás autoridades: nunca decide valores de diseño ni motion (ver "Precedencia").
- `web-design-guidelines` (`vercel-labs`) → checklist final de QA.
- `imagegen-frontend-web` (`Leonxlnx/taste-skill`) → respaldo, genera boards de referencia visual cuando no hay una referencia clara o no se logra adaptar/decidir cómo debe verse un elemento.

### Precedencia entre autoridades (en conflicto, gana la de arriba)

1. `DESIGN.md` y aprobaciones explícitas del usuario → valores de color, tipografía, espaciado.
2. `find-animation-opportunities` → SI se anima. `animate` → CÓMO.
3. `impeccable` → auditoría de diseño existente.
4. `design-taste-frontend` → solo propone dirección donde 1-3 no dicen nada.

Reglas de contención de `design-taste-frontend`:

- Si `DESIGN.md` define el valor, la skill no lo cambia. Si cree que debería cambiar, se trata como propuesta bajo la Regla 3 (incluida la excepción de paleta), nunca se aplica directo.
- Sus esqueletos de GSAP y su intensidad de motion solo se usan DESPUÉS de que `find-animation-opportunities` diga "sí anima" y la evaluación de valor UX diga "aporta".
- Sus tres dials se fijan en valores conservadores y se registran en `DESIGN.md`. Un dashboard o pantalla de app no usa los valores de una landing. La skill está orientada a landing pages, portfolios y rediseños: en pantallas funcionales de la app (mapa, formularios, listados, dashboards) usa solo su preflight anti-genérico, no su generación de dirección visual.
- Si `impeccable` ya auditó el mismo archivo en la tarea inmediatamente anterior sin cambios nuevos, el preflight de taste no se repite. Si ambas marcan lo mismo, se reporta una sola vez.
- Sus hallazgos se presentan como lista (Regla 2); no se aplican automáticamente.

---

## Pipeline obligatorio de ejecución (correr en TODA tarea de frontend)

Esto reemplaza la idea de "elegir una skill según la categoría de la tarea". En vez de clasificar la tarea una sola vez y arriesgarte a que quede ambigua, evalúa **los 7 ítems, en este orden, en cada tarea**, y responde explícitamente sí/no a cada uno antes de escribir código. No lo resumas ni lo omitas — este checklist debe aparecer en tu respuesta, visible, cada vez:

```
[ ] 1. ¿Hay imagen/screenshot adjunta?               → design-system (flujo imagen)
[ ] 2. ¿Hay archivos .tsx/.jsx de referencia?         → flujo de traducción React → Angular
[ ] 3. ¿Menciona/implica animación o movimiento?      → find-animation-opportunities primero,
                                                          luego animate (ver flujo de motion abajo)
[ ] 4. ¿Menciona/implica distribución, layout,
       tipografía, jerarquía visual, o pide mejorar/
       pulir algo existente?                          → impeccable
[ ] 5. ¿Toca más de un componente o página a la vez?  → extract-design-system
[ ] 6. ¿Se necesita una capacidad de UI nueva (toast,
       OTP, charts, drag&drop, virtualización, etc.)? → pick-ui-library ANTES de instalar algo
                                                          o preguntar
                                                          EXCEPCIÓN: dashboards/tablas/gráficos
                                                          ya están resueltos por la sección
                                                          "Flujo especial — Dashboards". No
                                                          invoques pick-ui-library para elegir
                                                          librería en ese caso; solo si la
                                                          necesidad cae FUERA de esa sección.
[ ] 7. ¿Hay que decidir/proponer la dirección visual
       de algo SIN spec en DESIGN.md y SIN referencia
       (imagen/código)? ¿O se cierra una tarea que
       creó UI nueva?                                 → design-taste-frontend (subordinada)
```

Puede activarse más de uno a la vez. El orden de ejecución cuando hay varios activos es siempre: **1 → 2 → 6 → 5 → 7 → 4 → 3**, es decir: primero obtienes la spec de diseño (imagen o React), luego resuelves qué librería/consistencia hace falta, luego propones dirección visual donde no hay spec (taste), luego criterio de layout sobre lo existente (Impeccable), y al final el motion — porque el motion depende de que el layout, los tokens y las librerías ya estén decididos, no al revés. Generar dirección (7) va antes de auditarla (4).

### Flujo de motion (paso 3) — usa las skills reales, no un criterio manual

1. Si la petición es vaga ("que se sienta más fluido", "que no se vea tan brusco"), corre `animation-vocabulary` primero para traducirla a términos precisos (curva, duración, propiedad) antes de decidir nada.
2. Corre `find-animation-opportunities` para decidir SI ese elemento debería animarse y qué no animar — **esta skill es la autoridad de esta decisión, no la reemplaces con tu propio criterio ni con las sugerencias de motion de `design-taste-frontend`.** Preséntame su conclusión antes de implementar.
3. Si la conclusión es "sí anima": usa `animate` para construirla (curva, duración, propiedades, entrada/salida), respetando GSAP/`@angular/animations` como las herramientas ya aprobadas. Los esqueletos de GSAP de `design-taste-frontend` solo pueden usarse como referencia en este punto, nunca antes.
4. Si la tarea es auditar motion ya existente: `review-animations` para un archivo puntual, `improve-animations` si es una pasada sobre todo el codebase — no uses la de codebase completo para revisar un solo componente.
5. Si ninguna de `animate`/`find-animation-opportunities`/`review-animations`/`improve-animations` cubre el caso (raro), recurre a `emil-design-eng` como skill general.

### Matriz de disparo — palabras clave y señales de contexto

No dependas solo de que el usuario use la palabra exacta "anima" o "mejora". Detecta también sinónimos e intención implícita:

| Skill                                                                            | Se activa si la tarea menciona (o implica)                                                                                                                    | Qué hace                                                                                                              | No la actives si                                                                                                                                                 |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `design-system`                                                                  | Hay una imagen adjunta, un screenshot, "recrea esto", "así se ve", "quiero que se parezca a"                                                                  | Genera/actualiza `design.md` con hex, medidas, tipografía exactos, ANTES de implementar                               | La tarea es puramente lógica/funcional sin componente visual nuevo                                                                                               |
| Traducción React→Angular                                                         | Se adjuntan `.tsx`/`.jsx`, o el usuario referencia un componente de una librería (21st.dev, Aceternity, Badtz UI, etc.)                                       | Extrae intención de motion/estado, traduce paradigma (no sintaxis) a GSAP + Angular                                   | El código de referencia ya es Angular/vanilla JS — ahí no hay nada que traducir                                                                                  |
| `find-animation-opportunities` + `animate` (+ `animation-vocabulary` si es vago) | "anima", "transición", "movimiento", "scroll", "hover", "se desliza", "rebota", "timing", "se siente lento/brusco"                                            | Decide si animar, con qué, y lo implementa                                                                            | La tarea es puramente estática/lógica sin ningún componente visual                                                                                               |
| `review-animations` / `improve-animations`                                       | "revisa las animaciones", "audita el motion", "esto se siente mal" sobre algo YA implementado                                                                 | Corrige motion existente contra reglas estrictas                                                                      | Es una animación nueva que aún no existe — ahí va `animate`, no la revisión                                                                                      |
| `impeccable`                                                                     | "distribución", "layout", "espaciado", "alineación", "jerarquía", "tipografía", "que se vea mejor/más profesional/menos genérico", "mejora", "pule", "audita" | Detecta y corrige patrones genéricos de IA (gradiente morado, Inter sin criterio, tarjetas anidadas, contraste pobre) | Ya se corrió sobre este mismo archivo/sección en la tarea inmediatamente anterior sin cambios nuevos de por medio                                                |
| `extract-design-system`                                                          | La tarea toca 2+ páginas/componentes, o dice "en toda la app", "en todas las páginas", "consistente con las demás"                                            | Verifica que los tokens no diverjan entre componentes                                                                 | Es un solo componente aislado sin relación con otros ya construidos                                                                                              |
| `pick-ui-library`                                                                | Se necesita toast, OTP input, drag&drop, virtualización, command menu, o cualquier capacidad de UI nueva                                                      | Elige la librería correcta de una lista curada, en vez de hand-rollear el componente o instalar algo sin evaluar      | Ya existe una librería aprobada para ese caso en la tabla de arriba (GSAP, Lenis, spartan/ui, Lucide, PrimeNG/ECharts/AG Grid para dashboards)                   |
| `design-taste-frontend`                                                          | Se crea UI nueva sin referencia, "que no se vea genérico", landing/marketing, o cierre de tarea con UI nueva                                                  | Propone dirección visual y corre preflight anti-slop, dentro de los límites de "Precedencia"                          | `DESIGN.md` ya especifica el componente, hay imagen/Figma de referencia, `impeccable` ya corrió sobre el mismo archivo sin cambios, o la skill no está instalada |

### Evaluación de valor UX — obligatoria antes de aplicar CUALQUIER motion (dentro del paso 3)

Antes de que `design-taste-frontend` aplique motion, instalar Lenis, o escribir una sola línea de GSAP, evalúa cada tipo de experiencia por separado. **No animes algo solo porque la herramienta está disponible.** El motion sin función es ruido visual, no mejora — cuesta tiempo de implementación, peso en el bundle, y puede sentirse más lento que la versión estática.

Para cada tipo de motion presente en la tarea actual, responde explícitamente "aporta" o "no aporta" con tu justificación, usando este criterio:

| Tipo de motion                                            | Pregunta de valor real                                                                                                                | Impleméntalo si...                                                                                                    | NO lo implementes si...                                                                                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Transición de página/ruta**                             | ¿El cambio de contexto es lo bastante grande como para que el usuario necesite una señal de "cambié de lugar"?                        | Hay pérdida de contexto real entre pantallas (ej. onboarding multi-paso, checkout) y la transición ayuda a orientarse | Es navegación simple tipo lista→detalle en una SPA donde el Router ya es instantáneo y claro — la transición solo demora la percepción de velocidad |
| **Scroll (Lenis + ScrollTrigger)**                        | ¿El contenido tiene una narrativa vertical larga donde el scroll cinematográfico aporta storytelling, o es solo una lista/formulario? | Landing pages, historias de producto, secciones que se revelan con propósito narrativo                                | Dashboards, tablas de datos, formularios, listados — ahí el smooth scroll añade latencia percibida sin beneficio                                    |
| **Hover**                                                 | ¿El hover comunica algo que el usuario necesita saber (que es clickeable, que cambia de estado)?                                      | Elementos interactivos ambiguos (tarjetas clickeables no obvias, botones con estado)                                  | Ya es obvio que es interactivo — un botón con estilo de botón no necesita un hover elaborado para "demostrar" que es un botón                       |
| **Feedback de botón/click**                               | ¿El usuario necesita confirmación de que su acción se registró?                                                                       | Casi siempre sí — bajo costo, alto valor (evita doble-click, confirma que "pasó algo")                                | Rara vez se descarta del todo, pero mantenla sutil (100-160ms) — no la conviertas en un show                                                        |
| **Entrada/salida de elementos** (fade, slide al aparecer) | ¿Ayuda a que el usuario entienda de dónde vino/hacia dónde va el elemento, o es solo decorativo?                                      | Modales, dropdowns, notificaciones — orientan sobre el origen/destino                                                 | Contenido que ya está en su posición final desde el primer render — animar su "entrada" ahí es puro adorno                                          |

**Reglas de esta evaluación:**

- Presenta esta tabla (o la parte relevante a la tarea) **antes** de tocar código, con tu conclusión de "aporta" / "no aporta" para cada tipo de motion presente en la tarea actual.
- Si concluyes "no aporta": no instales Lenis, no apliques motion vía `design-taste-frontend` para ese caso puntual, implementa el elemento estático y dilo explícitamente (ej. "decidí no animar la entrada de esta tarjeta porque ya es visible desde el primer render — animarla sería decorativo, no funcional").
- Si la decisión no es obvia (dudas genuinas entre animar o no), pregunta antes de decidir por tu cuenta — es una decisión de producto, no solo técnica.
- Aplica el mismo criterio a las sugerencias de `design-taste-frontend`: no implementes una sugerencia de mejora solo porque la skill la generó — evalúa si resuelve un problema real de este producto/usuario o es una preferencia estética genérica sin impacto medible.

### Estrategia de iconos — primaria y de respaldo

No mezcles librerías de iconos libremente — la inconsistencia de stroke/grid entre familias es tan visible como un font mixto sin criterio.

| Librería          | Rol                                                           | Por qué                                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@lucide/angular` | **Primaria — usar siempre por defecto**                       | Paquete oficial Angular, 1,500+ iconos, grid de 24px y stroke de 2px consistentes, personalizable con tokens de `DESIGN.md`                                                                                                                                                                                                                                   |
| `@ng-icons/core`  | **Respaldo — solo cuando Lucide no tenga el icono necesario** | Agregador de 115,000+ iconos de múltiples sets (Heroicons, Tabler, Material Symbols, Font Awesome) bajo un componente unificado. Al usarlo, fija UNA sola familia adicional como "segunda familia oficial" del proyecto (recomendado: Heroicons, por ser el más cercano en estilo a Lucide) — no mezcles iconos de 3+ familias distintas en la misma interfaz |

**Descartadas, con justificación:**

- **Angular Material (`mat-icon`)**: solo tiene sentido si adoptas el lenguaje visual de Material Design completo. Como tu Figma es un diseño custom, forzar `mat-icon` introduce un lenguaje visual ajeno, y arrastrar `@angular/material` completo solo para iconos es sobrepeso innecesario en el bundle.
- **Font Awesome (`@fortawesome/angular-fontawesome`)**: técnicamente sólida, pero su estética (especialmente en el set gratuito) es uno de los patrones más reconocibles de plantilla genérica/bootstrap — exactamente el tipo de señal que `impeccable` y `design-taste-frontend` están configuradas para detectar y marcar como "AI slop" en sus auditorías. Evítala salvo que el proyecto ya tenga una razón específica para usarla.
- **CoreUI Icons**: set decente (~2,000 iconos, MIT) pero sin ninguna ventaja real sobre Lucide para tu caso — menor variedad, sin paquete Angular tan pulido, y pensado para el ecosistema de plantillas CoreUI (dashboards Bootstrap), no para un diseño custom como el tuyo.

**Regla de activación**: si necesitas un icono y no lo encuentras en Lucide, dilo explícitamente ("no encontré un icono adecuado en Lucide para X") antes de recurrir a `@ng-icons/core` — no instales la segunda librería preventivamente "por si acaso".

---

## Flujo especial — Dashboards, tablas estadísticas y gráficos

Se activa si la tarea implica un dashboard, una tabla de datos (ordenar/filtrar/paginar/agrupar), un gráfico, un KPI card, o cualquier pantalla que presente datos numéricos. Se evalúa DENTRO del paso 6 del pipeline, antes de instalar o escribir nada.

### Stack asignado

| Necesidad                                                           | Herramienta                                 | Restricción                                                                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tabla (ordenar, filtrar, paginar, agrupar simple, exportar)         | PrimeNG `p-table`                           | Primera opción siempre                                                                                                                                     |
| Controles de filtro (select, multiselect, calendario)               | PrimeNG                                     | Solo si spartan/ui no cubre la primitiva (preguntar si hay duda)                                                                                           |
| Gráficos                                                            | ECharts vía `ngx-echarts`                   | Import por módulos, lazy-load del componente de gráfico                                                                                                    |
| Tabla con pivot, agrupación por filas con agregaciones, 100k+ filas | AG Grid **Community** únicamente            | Pivot/agrupación/agregaciones son **Enterprise (de pago)**. **Prohibido** usar Enterprise sin preguntarme. Si la necesidad exige Enterprise, dilo y espera |
| KPI cards, layout del dashboard, contenedores                       | HTML + CSS propio con tokens de `DESIGN.md` | NO usar componentes de PrimeNG para esto                                                                                                                   |

### Reglas obligatorias

1. **Antes de instalar PrimeNG**: verifica que su versión sea compatible con la versión de Angular del proyecto (leer `package.json`, consultar la documentación oficial). Si no puedes verificarlo, dilo y pregunta. No asumas.
2. **Tematización obligatoria desde `DESIGN.md`**: PrimeNG se configura con su sistema de tokens/preset personalizado alimentado por los valores de `DESIGN.md` (color, radio, tipografía, espaciado). Prohibido dejar el tema por defecto. Si un componente no se puede alinear con `DESIGN.md`, repórtalo en vez de aceptar la desviación.
3. **Iconos**: los componentes de PrimeNG deben usar Lucide (Regla de "Estrategia de iconos"). No cargar PrimeIcons salvo que Lucide no cubra el caso y lo hayas declarado.
4. **Tema de ECharts propio**: registrar un tema con paleta, tipografía, grosores y colores de ejes/tooltips tomados de `DESIGN.md`. Prohibido usar la paleta por defecto de ECharts. Si `DESIGN.md` no define una paleta para series de datos, aplica la Regla 3 (excepción de paleta) y propónla antes de implementar.
5. **Bundle**: importar solo los módulos de ECharts usados (`echarts/core` + los charts/componentes/renderer necesarios). Prohibido `import * as echarts from 'echarts'`. Los gráficos pesados se cargan de forma diferida.
6. **Evaluación de valor UX del motion en gráficos**: la animación por defecto de ECharts también cae bajo la "Evaluación de valor UX". Decide explícitamente si la animación de entrada aporta. Para dashboards de consulta recurrente, el criterio por defecto es **no animar la carga inicial** y mantener solo el feedback de tooltip/hover. Lenis y scroll cinematográfico están prohibidos en dashboards (ya lo dice la tabla de motion; se repite aquí por claridad).
7. **Accesibilidad**: los gráficos son canvas y no son legibles por lectores de pantalla por defecto. Activar el módulo/opción de aria de ECharts con descripciones, y cuando el gráfico comunique datos críticos, ofrecer los mismos datos en tabla. Si algo no se pudo cubrir, dilo.
8. **Datos y backend**: `apps/backend` sigue intocable. Si el dashboard necesita un endpoint que no existe, NO lo crees ni lo modifiques: usa datos mock tipados claramente marcados como temporales, y dime qué endpoint falta y con qué forma de respuesta.
9. **Estados que no se pueden omitir**: cada tabla y gráfico debe resolver los estados vacío, carga y error. Si la referencia visual no los muestra, dilo (Flujo de imagen: no inventar con confianza) y propón el diseño para aprobación.
10. **Verificación visual con Playwright**: para comparar screenshots de gráficos, desactiva la animación de ECharts durante el test o espera a que termine; si no, el diff será ruido. Reporta el diff con números.
11. **No mezclar**: una pantalla no usa `p-table` y AG Grid a la vez. Si cambias de una a otra, se cambia en todas las tablas del módulo (`extract-design-system` para verificar consistencia).

### Resumen obligatorio al cerrar una tarea de dashboard

Indica explícitamente: qué librería resolvió cada pieza, cómo se tematizó desde `DESIGN.md`, si algún componente quedó con desviación del diseño, qué módulos de ECharts se importaron, qué estados (vacío/carga/error) se cubrieron, y qué datos son mock.

### Fallback — board de referencia visual (`imagegen-frontend-web`)

Esto se activa en cualquiera de estos casos, sin importar en qué paso del pipeline estés:

- `design-system` no logra extraer una spec clara de la imagen dada (ambigüedad real: resolución baja, elemento parcialmente visible, estilo no identificable).
- El flujo de traducción React → Angular llega a un punto donde no hay un equivalente razonable en GSAP/Angular para lo que hace el componente original.
- `design-taste-frontend` o `impeccable` señalan un problema pero no tienes un patrón concreto y mejor para reemplazarlo.
- Se pide crear o recrear un elemento de frontend y **no está claro cómo debería verse o comportarse**, no hay ninguna referencia disponible (ni imagen, ni código, ni Figma), o la referencia dada no existe/no es localizable.

En estos casos, **no improvises una solución a ciegas ni fuerces una adaptación de baja calidad**. Usa `imagegen-frontend-web` para generar un board de referencia visual alternativo, preséntamelo, y espera aprobación antes de implementar sobre esa nueva referencia. Si después de esto sigue sin haber una opción clara, dilo explícitamente y pregunta en vez de decidir por tu cuenta — esta skill es para destrabar, no para reemplazar tu criterio de aprobación.

### Reglas incondicionales del pipeline (no dependen de detectar nada)

- **`DESIGN.md` se consulta siempre**, en cada tarea que toque UI, sin excepción — no es parte del checklist condicional, es un paso 0 fijo antes de cualquiera de los 7 ítems.
- **Vercel Web Design Guidelines (`web-design-guidelines`) se corre siempre al cerrar cualquier tarea de frontend**, sin condición — no es opcional ni depende de palabras clave. Repórtalo aunque no encuentre nada que corregir (dilo explícitamente: "checklist corrido, sin hallazgos").
- Si terminaste el checklist de los 7 ítems y **ninguno aplicó**, dilo explícitamente ("ninguna skill aplica a esta tarea, es cambio puramente funcional/lógico") en vez de omitir la sección — así confirmo que sí lo evaluaste y no que lo saltaste.

---

## Flujo especial — Paso 1 del pipeline: Recrear desde una imagen (sin Figma)

Este es el único camino válido cuando se da una imagen o screenshot como referencia. No lo saltees ni lo comprimas en un solo paso.

1. **Extrae la spec primero**: usa `design-system` sobre la imagen para generar/actualizar `design.md` + `design-guidelines.md` + `design-components.md` con valores concretos (hex exactos, medidas en px, tipografía, specs por componente). No implementes todavía.
2. **Implementa** usando ese documento como fuente, no reinterpretando la imagen en cada archivo — así se evita que cada componente "adivine" un poco distinto.
3. **Verifica objetivamente**: guarda la imagen original como baseline de Playwright y corre:
   ```js
   await expect(page).toHaveScreenshot('referencia.png', { maxDiffPixelRatio: 0.02 });
   ```
   Reporta el resultado del diff **con números**. Nunca afirmar "coincide" o "quedó igual" sin haber corrido esta verificación.
4. Si el diff supera el umbral, indicar específicamente qué zona o componente falló (no reintentar a ciegas todo el archivo).

Cuando hay imagen de referencia, `design-taste-frontend` **no interviene en la dirección visual**: la imagen ya la define. Solo puede correr su preflight al cierre, y sus hallazgos se presentan como lista, no se aplican.

Sé honesto sobre el límite real de este proceso: ninguna recreación desde imagen es perfecta por definición. Si algo queda ambiguo (un estado que la imagen no muestra: hover, error, loading), dilo explícitamente en vez de inventarlo con confianza.

---

## Flujo especial — Paso 2 del pipeline: Traducir un ejemplo de código React a Angular

Cuando se entreguen archivos `.tsx`/`.jsx` de una librería de terceros (por ejemplo, componentes animados de 21st.dev, Badtz UI, Aceternity UI, etc.) como referencia de comportamiento/animación, **no son código del proyecto ni deben copiarse literalmente**. Sigue este proceso:

1. **Pide siempre todos los archivos relacionados**, no solo el componente. Si hay un archivo `demo`/`example`/`usage`, pídelo también — muestra cómo se integra el componente (props, estado inicial, wrapper), contexto que el componente aislado no da.

2. **Identifica el paradigma de animación usado** (casi siempre Framer Motion/Motion en este ecosistema) y extrae la intención, no la sintaxis: qué se anima, con qué duración, qué easing, en qué disparador (click, cambio de estado, mount/unmount). Framer Motion es declarativo y atado al ciclo de vida de React; GSAP en Angular es imperativo y se controla en los hooks de ciclo de vida de Angular (`ngAfterViewInit` para iniciar, `ngOnDestroy` para limpiar la timeline). **No es una traducción de sintaxis 1:1, es una traducción de paradigma.**

3. **Traduce el estado**: de `useState`/props de React a la forma nativa de Angular del proyecto (signals si ya se usan, o propiedades de clase si no).

4. **Traduce la animación a GSAP**, contrastando los valores de timing/easing del código React contra los criterios de `animate` y `review-animations` (la autoridad de motion) — no repliques un valor solo porque así estaba en el original si contradice esos criterios (ej. un `ease-in` en un botón debe corregirse, no copiarse). `design-taste-frontend` solo puede aportar si no contradice a esas skills.

5. **Traduce el markup/JSX a template Angular equivalente** (condicionales, bindings, eventos). No debe quedar sintaxis JSX, `className`, ni fragmentos de React sin adaptar.

6. **Verifica accesibilidad heredada**: si el componente original depende de Radix UI u otra librería headless de React para foco/teclado/aria-*, confirma manualmente que el equivalente en Angular (spartan/ui si aplica, o implementación propia) cubre lo mismo — no lo omitas en silencio.

7. **Reporta la traducción de forma explícita al terminar**: no basta con decir "implementado". Indica concretamente cómo se tradujo el timing/easing/disparador de Framer Motion a GSAP (ej. "el fade-in de 300ms con ease-out de Framer se tradujo a GSAP `duration: 0.3, ease: 'power2.out'`, disparado en `ngAfterViewInit`"). Esto es lo que confirma que hubo traducción consciente y no un copy-paste renombrado con bugs silenciosos (el más común: un `useEffect` de limpieza que no se tradujo a `ngOnDestroy`, dejando una timeline de GSAP corriendo después de destruir el componente — memory leak real, no cosmético).

---

## Reglas fijas — sin excepción

1. **Antes de escribir código**: explica en 3-5 líneas qué se va a hacer, qué skill(s) se usarán y por qué, y dónde se colocarán los archivos según el patrón arquitectónico ya existente en el proyecto. Espera aprobación si el cambio toca más de un archivo o crea una carpeta nueva.

2. Nunca apliques sugerencias de "polish"/"critique"/mejora de forma automática — preséntalas como lista, la decisión de cuáles aplicar es del usuario.

3. Si un cambio pedido contradice algo ya definido en `DESIGN.md`, dilo explícitamente antes de proceder — no lo sobrescribas en silencio.

   **Excepción — paleta de color**: si durante cualquier tarea se detecta que otra paleta serviría mejor al producto (mejor contraste/accesibilidad, mejor coherencia con `PRODUCT.md`, o resuelve un problema concreto detectado), puedes **proponerla activamente** sin que se pida. Preséntala así, siempre antes de aplicarla:
   - a. La paleta actual en `DESIGN.md`.
   - b. La paleta propuesta, con los valores hex exactos.
   - c. La razón concreta (no "se ve mejor" — indicar qué problema resuelve: contraste insuficiente, inconsistencia con el resto del sistema, jerarquía poco clara, etc.).

   Si se aprueba el cambio, actualizar `DESIGN.md` en el mismo paso y aplicar la nueva paleta de forma consistente en todos los componentes ya construidos, no solo en el que se estaba tocando cuando se detectó. Las propuestas de paleta que nazcan de `design-taste-frontend` siguen exactamente este mismo proceso.

4. Si la tarea requeriría una librería o skill que no está instalada (hoy: `design-taste-frontend`), decirlo y justificar por qué las actuales no alcanzan — no instalarla ni simularla con una implementación manual sin avisar primero.

5. No reestructurar carpetas ya organizadas según el patrón detectado previamente en el proyecto, salvo que la tarea lo requiera explícita y claramente — en ese caso, decirlo en el resumen del punto 1.

6. No usar Figma ni ningún MCP de Figma en este proyecto salvo que se pida explícitamente en el futuro.

7. El checklist del **pipeline obligatorio** (los 7 ítems) debe aparecer, visible, en toda tarea de frontend, sin excepción — incluso cuando la respuesta a los 7 sea "no". Una respuesta que no incluya el checklist se considera incompleta y debe rehacerse. Esta regla existe porque delegar la decisión de "cuándo mostrar el checklist" al propio criterio del agente es exactamente lo que causaba que las skills clave no se activaran cuando debían — la visibilidad forzada es la garantía, no la buena intención.

---

## Tarea de hoy

> _[Describe aquí la modificación, implementación, o adjunta la imagen a recrear]_
