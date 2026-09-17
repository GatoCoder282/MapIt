# Prompt del agente — Proyecto MapIt

## Contexto fijo del proyecto

Monorepo pnpm. Frontend Angular en `apps/<tu-app-angular>`. Backend Kotlin/Java en `apps/backend` — **no lo toques bajo ninguna circunstancia**, ni siquiera para "arreglar" algo relacionado.

### Librerías de frontend ya decididas y aprobadas

No instales otras sin preguntar primero y justificar por qué estas no alcanzan.

| Librería                   | Uso                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@angular/animations`      | Transiciones simples de UI (hover, estado, entrada/salida)                                                                   |
| GSAP + ScrollTrigger       | Animaciones complejas, scroll-driven                                                                                         |
| Lenis                      | Solo si la referencia visual pide scroll cinematográfico explícito                                                           |
| spartan/ui (`@spartan-ng`) | Solo si falta una primitiva headless que el HTML/imagen no resuelve por sí sola                                              |
| `@playwright/test`         | Verificación visual (ver flujo de recreación abajo)                                                                          |
| `@lucide/angular`          | Librería de iconos — variedad, consistencia de stroke/grid, personalizable con tokens de `DESIGN.md` (color, tamaño, grosor) |
| `@ng-icons/core`           | Respaldo de iconos — solo si Lucide no cubre un icono necesario (ver "Estrategia de iconos" abajo)                           |

### Documentos vivos de referencia

Actualízalos cuando yo apruebe un cambio que los contradiga — nunca los sobrescribas en silencio, **excepto** la excepción de paleta de color detallada en la Regla 3 más abajo.

- `DESIGN.md` / `design-guidelines.md` / `design-components.md` → tokens, specs de componente, jerarquía. Fuente única de verdad para valores de diseño.
- `PRODUCT.md` → a quién sirve el producto, tono, audiencia.

### Skills instaladas (agente: OpenCode, en `.agents/skills`)

Activa según el tipo de tarea, no todas a la vez. Inventario real, no una simplificación:

**Del paquete `emilkowalski/skills` (12 skills, motion + design engineering):**

- `find-animation-opportunities` → decide SI algo debería animarse y qué NO animar. **Es la autoridad para esta decisión — no la sustituyas por criterio propio.**
- `animate` → construye una animación desde cero (curva, duración, propiedades, entrada/salida) una vez decidido que sí vale la pena.
- `animation-vocabulary` → traduce una petición vaga de motion ("que se sienta más fluido") a términos precisos, antes de invocar `animate`.
- `review-animations` → audita el motion de un archivo/componente puntual con reglas estrictas.
- `improve-animations` → audita el motion de **todo el codebase** y devuelve un plan priorizado — úsala para pasadas globales, no por archivo.
- `pick-ui-library` → elige la librería correcta para una necesidad de UI (toasts, OTP, charts, drag&drop, virtualización, command menus) de una lista curada y confiable. **Consúltala primero** cuando se necesite una capacidad nueva, antes de preguntarme a mí o de que el agente decida por su cuenta.
- `emil-design-eng` → skill general de diseño/motion, úsala solo si ninguna de las anteriores, más específicas, cubre el caso.
- `apple-design` → principios de Apple/WWDC para web. **Opt-in explícito únicamente** — tu Figma ya define la estética del proyecto; no debe activarse automáticamente ni competir con `DESIGN.md`.
- `prototype` → genera varias versiones de una UI para elegir visualmente. Solo se invoca a pedido explícito, nunca automático.
- `animate-expo`, `ask-sonner`, `write-swift` → **instaladas pero no aplican a este proyecto** (Expo/React Native, toast de React, y Swift/iOS respectivamente — nada de esto existe en el stack Angular + Kotlin/Java de MapIt). No las actives en ningún flujo.

**Externas:**

- `design-system` (`albertzhangz10/design-system-skill`) → convertir una imagen/screenshot en `design.md` / `design-guidelines.md` / `design-components.md` **antes** de implementar.
- `extract-design-system` (`arvindrk`) → consistencia de tokens entre múltiples páginas/componentes.
- `impeccable` (`pbakaus`) → auditar/mejorar diseño ya existente (layout, tipografía, jerarquía, anti-slop).
- `web-design-guidelines` (`vercel-labs`) → checklist final de QA.
- `imagegen-frontend-web` (`Leonxlnx/taste-skill`) → respaldo, genera boards de referencia visual cuando no hay una referencia clara o no se logra adaptar/decidir cómo debe verse un elemento.

---

## Pipeline obligatorio de ejecución (correr en TODA tarea de frontend)

Esto reemplaza la idea de "elegir una skill según la categoría de la tarea". En vez de clasificar la tarea una sola vez y arriesgarte a que quede ambigua, evalúa **las cinco skills, en este orden, en cada tarea**, y responde explícitamente sí/no a cada una antes de escribir código. No lo resumas ni lo omitas — este checklist debe aparecer en tu respuesta, visible, cada vez:

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
```

Puede activarse más de una a la vez. El orden de ejecución cuando hay varias activas es siempre: **1 → 2 → 6 → 5 → 4 → 3**, es decir: primero obtienes la spec de diseño (imagen o React), luego resuelves qué librería/consistencia hace falta, luego criterio de layout (Impeccable), y al final el motion — porque el motion depende de que el layout, los tokens y las librerías ya estén decididos, no al revés.

### Flujo de motion (paso 3) — usa las skills reales, no un criterio manual

1. Si la petición es vaga ("que se sienta más fluido", "que no se vea tan brusco"), corre `animation-vocabulary` primero para traducirla a términos precisos (curva, duración, propiedad) antes de decidir nada.
2. Corre `find-animation-opportunities` para decidir SI ese elemento debería animarse y qué no animar — **esta skill es la autoridad de esta decisión, no la reemplaces con tu propio criterio.** Preséntame su conclusión antes de implementar.
3. Si la conclusión es "sí anima": usa `animate` para construirla (curva, duración, propiedades, entrada/salida), respetando GSAP/`@angular/animations` como las herramientas ya aprobadas.
4. Si la tarea es auditar motion ya existente: `review-animations` para un archivo puntual, `improve-animations` si es una pasada sobre todo el codebase — no uses la de codebase completo para revisar un solo componente.
5. Si ninguna de `animate`/`find-animation-opportunities`/`review-animations`/`improve-animations` cubre el caso (raro), recurre a `emil-design-eng` como skill general.

### Matriz de disparo — palabras clave y señales de contexto

No dependas solo de que el usuario use la palabra exacta "anima" o "mejora". Detecta también sinónimos e intención implícita:

| Skill                                                                            | Se activa si la tarea menciona (o implica)                                                                                                                    | Qué hace                                                                                                              | No la actives si                                                                                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `design-system`                                                                  | Hay una imagen adjunta, un screenshot, "recrea esto", "así se ve", "quiero que se parezca a"                                                                  | Genera/actualiza `design.md` con hex, medidas, tipografía exactos, ANTES de implementar                               | La tarea es puramente lógica/funcional sin componente visual nuevo                                                |
| Traducción React→Angular                                                         | Se adjuntan `.tsx`/`.jsx`, o el usuario referencia un componente de una librería (21st.dev, Aceternity, Badtz UI, etc.)                                       | Extrae intención de motion/estado, traduce paradigma (no sintaxis) a GSAP + Angular                                   | El código de referencia ya es Angular/vanilla JS — ahí no hay nada que traducir                                   |
| `find-animation-opportunities` + `animate` (+ `animation-vocabulary` si es vago) | "anima", "transición", "movimiento", "scroll", "hover", "se desliza", "rebota", "timing", "se siente lento/brusco"                                            | Decide si animar, con qué, y lo implementa                                                                            | La tarea es puramente estática/lógica sin ningún componente visual                                                |
| `review-animations` / `improve-animations`                                       | "revisa las animaciones", "audita el motion", "esto se siente mal" sobre algo YA implementado                                                                 | Corrige motion existente contra reglas estrictas                                                                      | Es una animación nueva que aún no existe — ahí va `animate`, no la revisión                                       |
| `impeccable`                                                                     | "distribución", "layout", "espaciado", "alineación", "jerarquía", "tipografía", "que se vea mejor/más profesional/menos genérico", "mejora", "pule", "audita" | Detecta y corrige patrones genéricos de IA (gradiente morado, Inter sin criterio, tarjetas anidadas, contraste pobre) | Ya se corrió sobre este mismo archivo/sección en la tarea inmediatamente anterior sin cambios nuevos de por medio |
| `extract-design-system`                                                          | La tarea toca 2+ páginas/componentes, o dice "en toda la app", "en todas las páginas", "consistente con las demás"                                            | Verifica que los tokens no diverjan entre componentes                                                                 | Es un solo componente aislado sin relación con otros ya construidos                                               |
| `pick-ui-library`                                                                | Se necesita toast, OTP input, charts, drag&drop, virtualización, command menu, o cualquier capacidad de UI nueva                                              | Elige la librería correcta de una lista curada, en vez de hand-rollear el componente o instalar algo sin evaluar      | Ya existe una librería aprobada para ese caso en la tabla de arriba (GSAP, Lenis, spartan/ui, Lucide)             |

### Evaluación de valor UX — obligatoria antes de aplicar CUALQUIER motion (dentro del paso 3)

Antes de que `design-taste` aplique motion, instalar Lenis, o escribir una sola línea de GSAP, evalúa cada tipo de experiencia por separado. **No animes algo solo porque la herramienta está disponible.** El motion sin función es ruido visual, no mejora — cuesta tiempo de implementación, peso en el bundle, y puede sentirse más lento que la versión estática.

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
- Si concluyes "no aporta": no instales Lenis, no apliques motion vía `design-taste` para ese caso puntual, implementa el elemento estático y dilo explícitamente (ej. "decidí no animar la entrada de esta tarjeta porque ya es visible desde el primer render — animarla sería decorativo, no funcional").
- Si la decisión no es obvia (dudas genuinas entre animar o no), pregunta antes de decidir por tu cuenta — es una decisión de producto, no solo técnica.
- Aplica el mismo criterio a las sugerencias de `design-taste`: no implementes una sugerencia de mejora solo porque la skill la generó — evalúa si resuelve un problema real de este producto/usuario o es una preferencia estética genérica sin impacto medible.

### Estrategia de iconos — primaria y de respaldo

No mezcles librerías de iconos libremente — la inconsistencia de stroke/grid entre familias es tan visible como un font mixto sin criterio.

| Librería          | Rol                                                           | Por qué                                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@lucide/angular` | **Primaria — usar siempre por defecto**                       | Paquete oficial Angular, 1,500+ iconos, grid de 24px y stroke de 2px consistentes, personalizable con tokens de `DESIGN.md`                                                                                                                                                                                                                                   |
| `@ng-icons/core`  | **Respaldo — solo cuando Lucide no tenga el icono necesario** | Agregador de 115,000+ iconos de múltiples sets (Heroicons, Tabler, Material Symbols, Font Awesome) bajo un componente unificado. Al usarlo, fija UNA sola familia adicional como "segunda familia oficial" del proyecto (recomendado: Heroicons, por ser el más cercano en estilo a Lucide) — no mezcles iconos de 3+ familias distintas en la misma interfaz |

**Descartadas, con justificación:**

- **Angular Material (`mat-icon`)**: solo tiene sentido si adoptas el lenguaje visual de Material Design completo. Como tu Figma es un diseño custom, forzar `mat-icon` introduce un lenguaje visual ajeno, y arrastrar `@angular/material` completo solo para iconos es sobrepeso innecesario en el bundle.
- **Font Awesome (`@fortawesome/angular-fontawesome`)**: técnicamente sólida, pero su estética (especialmente en el set gratuito) es uno de los patrones más reconocibles de plantilla genérica/bootstrap — exactamente el tipo de señal que `design-taste` está configurada para detectar y marcar como "AI slop" en sus auditorías. Evítala salvo que el proyecto ya tenga una razón específica para usarla.
- **CoreUI Icons**: set decente (~2,000 iconos, MIT) pero sin ninguna ventaja real sobre Lucide para tu caso — menor variedad, sin paquete Angular tan pulido, y pensado para el ecosistema de plantillas CoreUI (dashboards Bootstrap), no para un diseño custom como el tuyo.

**Regla de activación**: si necesitas un icono y no lo encuentras en Lucide, dilo explícitamente ("no encontré un icono adecuado en Lucide para X") antes de recurrir a `@ng-icons/core` — no instales la segunda librería preventivamente "por si acaso".

Esto se activa en cualquiera de estos casos, sin importar en qué paso del pipeline estés:

- El `design-system-skill` no logra extraer una spec clara de la imagen dada (ambigüedad real: resolución baja, elemento parcialmente visible, estilo no identificable).
- El flujo de traducción React → Angular llega a un punto donde no hay un equivalente razonable en GSAP/Angular para lo que hace el componente original.
- `design-taste` señala un problema pero no tienes un patrón concreto y mejor para reemplazarlo.
- Se pide crear o recrear un elemento de frontend y **no está claro cómo debería verse o comportarse**, no hay ninguna referencia disponible (ni imagen, ni código, ni Figma), o la referencia dada no existe/no es localizable.

En estos casos, **no improvises una solución a ciegas ni fuerces una adaptación de baja calidad**. Usa la sub-skill `imagegen-frontend-web` de Taste Skill para generar un board de referencia visual alternativo, preséntamelo, y espera aprobación antes de implementar sobre esa nueva referencia. Si después de esto sigue sin haber una opción clara, dilo explícitamente y pregunta en vez de decidir por tu cuenta — esta skill es para destrabar, no para reemplazar tu criterio de aprobación.

### Reglas incondicionales del pipeline (no dependen de detectar nada)

- **`DESIGN.md` se consulta siempre**, en cada tarea que toque UI, sin excepción — no es parte del checklist condicional, es un paso 0 fijo antes de cualquiera de las cuatro skills.
- **Vercel Web Design Guidelines se corre siempre al cerrar cualquier tarea de frontend**, sin condición — no es opcional ni depende de palabras clave. Repórtalo aunque no encuentre nada que corregir (dilo explícitamente: "checklist corrido, sin hallazgos").
- Si terminaste el checklist de las 4 skills y **ninguna aplicó**, dilo explícitamente ("ninguna skill aplica a esta tarea, es cambio puramente funcional/lógico") en vez de omitir la sección — así confirmo que sí lo evaluaste y no que lo saltaste.

---

## Flujo especial — Paso 1 del pipeline: Recrear desde una imagen (sin Figma)

Este es el único camino válido cuando se da una imagen o screenshot como referencia. No lo saltees ni lo comprimas en un solo paso.

1. **Extrae la spec primero**: usa `design-system-skill` sobre la imagen para generar/actualizar `design.md` + `design-guidelines.md` + `design-components.md` con valores concretos (hex exactos, medidas en px, tipografía, specs por componente). No implementes todavía.
2. **Implementa** usando ese documento como fuente, no reinterpretando la imagen en cada archivo — así se evita que cada componente "adivine" un poco distinto.
3. **Verifica objetivamente**: guarda la imagen original como baseline de Playwright y corre:
   ```js
   await expect(page).toHaveScreenshot('referencia.png', { maxDiffPixelRatio: 0.02 });
   ```
   Reporta el resultado del diff **con números**. Nunca afirmar "coincide" o "quedó igual" sin haber corrido esta verificación.
4. Si el diff supera el umbral, indicar específicamente qué zona o componente falló (no reintentar a ciegas todo el archivo).

Sé honesto sobre el límite real de este proceso: ninguna recreación desde imagen es perfecta por definición. Si algo queda ambiguo (un estado que la imagen no muestra: hover, error, loading), dilo explícitamente en vez de inventarlo con confianza.

---

## Flujo especial — Paso 2 del pipeline: Traducir un ejemplo de código React a Angular

Cuando se entreguen archivos `.tsx`/`.jsx` de una librería de terceros (por ejemplo, componentes animados de 21st.dev, Badtz UI, Aceternity UI, etc.) como referencia de comportamiento/animación, **no son código del proyecto ni deben copiarse literalmente**. Sigue este proceso:

1. **Pide siempre todos los archivos relacionados**, no solo el componente. Si hay un archivo `demo`/`example`/`usage`, pídelo también — muestra cómo se integra el componente (props, estado inicial, wrapper), contexto que el componente aislado no da.

2. **Identifica el paradigma de animación usado** (casi siempre Framer Motion/Motion en este ecosistema) y extrae la intención, no la sintaxis: qué se anima, con qué duración, qué easing, en qué disparador (click, cambio de estado, mount/unmount). Framer Motion es declarativo y atado al ciclo de vida de React; GSAP en Angular es imperativo y se controla en los hooks de ciclo de vida de Angular (`ngAfterViewInit` para iniciar, `ngOnDestroy` para limpiar la timeline). **No es una traducción de sintaxis 1:1, es una traducción de paradigma.**

3. **Traduce el estado**: de `useState`/props de React a la forma nativa de Angular del proyecto (signals si ya se usan, o propiedades de clase si no).

4. **Traduce la animación a GSAP**, contrastando los valores de timing/easing del código React contra los criterios de la skill `design-taste` — no repliques un valor solo porque así estaba en el original si contradice esos criterios (ej. un `ease-in` en un botón debe corregirse, no copiarse).

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

   Si se aprueba el cambio, actualizar `DESIGN.md` en el mismo paso y aplicar la nueva paleta de forma consistente en todos los componentes ya construidos, no solo en el que se estaba tocando cuando se detectó.

4. Si la tarea requeriría una librería o skill que no está instalada, decirlo y justificar por qué las actuales no alcanzan — no instalarla ni simularla con una implementación manual sin avisar primero.

5. No reestructurar carpetas ya organizadas según el patrón detectado previamente en el proyecto, salvo que la tarea lo requiera explícita y claramente — en ese caso, decirlo en el resumen del punto 1.

6. No usar Figma ni ningún MCP de Figma en este proyecto salvo que se pida explícitamente en el futuro.

7. El checklist del **pipeline obligatorio** (las 4 preguntas) debe aparecer, visible, en toda tarea de frontend, sin excepción — incluso cuando la respuesta a las 4 sea "no". Una respuesta que no incluya el checklist se considera incompleta y debe rehacerse. Esta regla existe porque delegar la decisión de "cuándo mostrar el checklist" al propio criterio del agente es exactamente lo que causaba que las skills clave no se activaran cuando debían — la visibilidad forzada es la garantía, no la buena intención.

---

## Tarea de hoy

> _[Describe aquí la modificación, implementación, o adjunta la imagen a recrear]_
