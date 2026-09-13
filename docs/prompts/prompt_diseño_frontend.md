# Prompt del agente — Proyecto MapIt

## Contexto fijo del proyecto

Monorepo pnpm. Frontend Angular en `apps/<tu-app-angular>`. Backend Kotlin/Java en `apps/backend` — **no lo toques bajo ninguna circunstancia**, ni siquiera para "arreglar" algo relacionado.

### Librerías de frontend ya decididas y aprobadas

No instales otras sin preguntar primero y justificar por qué estas no alcanzan.

| Librería                   | Uso                                                                             |
| -------------------------- | ------------------------------------------------------------------------------- |
| `@angular/animations`      | Transiciones simples de UI (hover, estado, entrada/salida)                      |
| GSAP + ScrollTrigger       | Animaciones complejas, scroll-driven                                            |
| Lenis                      | Solo si la referencia visual pide scroll cinematográfico explícito              |
| spartan/ui (`@spartan-ng`) | Solo si falta una primitiva headless que el HTML/imagen no resuelve por sí sola |
| `@playwright/test`         | Verificación visual (ver flujo de recreación abajo)                             |

### Documentos vivos de referencia

Actualízalos cuando yo apruebe un cambio que los contradiga — nunca los sobrescribas en silencio, **excepto** la excepción de paleta de color detallada en la Regla 3 más abajo.

- `DESIGN.md` / `design-guidelines.md` / `design-components.md` → tokens, specs de componente, jerarquía. Fuente única de verdad para valores de diseño.
- `PRODUCT.md` → a quién sirve el producto, tono, audiencia.

### Skills instaladas (agente: OpenCode)

Actívalas según el tipo de tarea, no todas a la vez.

- `pbakaus/impeccable` → auditar/mejorar diseño ya existente
- `emilkowalski/skill` → motion (timing, easing, `prefers-reduced-motion`)
- `arvindrk/extract-design-system@extract-design-system` → consistencia de tokens entre múltiples páginas/componentes
- `vercel-labs/agent-skills@web-design-guidelines` → checklist final de QA
- `albertzhangz10/design-system-skill` → convertir una imagen/screenshot en `design.md` / `design-guidelines.md` / `design-components.md` **antes** de implementar

---

## Regla de activación de skills por tipo de tarea

- **¿Es sobre animación/motion?** → skill de Emil Kowalski. No la invoques si la tarea no toca motion.
- **¿Es crear/modificar un componente o página?** → consulta primero `DESIGN.md`. No inventes tokens nuevos. Si el HTML/imagen fuente trae algo que no está documentado, dilo antes de decidir un valor por tu cuenta.
- **¿Es mejorar/auditar algo que ya funciona?** → Impeccable (`/impeccable critique` o `/impeccable audit`) **solo** sobre el archivo o sección indicada, no sobre todo el proyecto salvo que se pida explícitamente.
- **¿Toca múltiples páginas/componentes a la vez?** → `extract-design-system` para verificar consistencia de tokens antes de aplicar el cambio en cada uno.
- **¿Es recrear un componente/página desde una imagen?** → sigue el flujo especial de abajo. No implementes directamente mirando la imagen en cada paso.
- **¿Se entregaron archivos `.tsx`/`.jsx` de una librería de terceros como referencia?** → sigue el flujo especial de traducción React → Angular más abajo. Nunca copiar/pegar la sintaxis original.
- **¿Es el último paso antes de cerrar la tarea?** → corre el checklist de Vercel Web Design Guidelines sobre lo modificado (no sobre todo el proyecto) y reporta qué falta, sin corregirlo automáticamente si implica un cambio de diseño no pedido.

---

## Flujo especial — Recrear desde una imagen (sin Figma)

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

## Flujo especial — Traducir un ejemplo de código React a Angular

Cuando se entreguen archivos `.tsx`/`.jsx` de una librería de terceros (por ejemplo, componentes animados de 21st.dev, Badtz UI, Aceternity UI, etc.) como referencia de comportamiento/animación, **no son código del proyecto ni deben copiarse literalmente**. Sigue este proceso:

1. **Pide siempre todos los archivos relacionados**, no solo el componente. Si hay un archivo `demo`/`example`/`usage`, pídelo también — muestra cómo se integra el componente (props, estado inicial, wrapper), contexto que el componente aislado no da.

2. **Identifica el paradigma de animación usado** (casi siempre Framer Motion/Motion en este ecosistema) y extrae la intención, no la sintaxis: qué se anima, con qué duración, qué easing, en qué disparador (click, cambio de estado, mount/unmount). Framer Motion es declarativo y atado al ciclo de vida de React; GSAP en Angular es imperativo y se controla en los hooks de ciclo de vida de Angular (`ngAfterViewInit` para iniciar, `ngOnDestroy` para limpiar la timeline). **No es una traducción de sintaxis 1:1, es una traducción de paradigma.**

3. **Traduce el estado**: de `useState`/props de React a la forma nativa de Angular del proyecto (signals si ya se usan, o propiedades de clase si no).

4. **Traduce la animación a GSAP**, contrastando los valores de timing/easing del código React contra los criterios de la skill de Emil Kowalski — no repliques un valor solo porque así estaba en el original si contradice esos criterios (ej. un `ease-in` en un botón debe corregirse, no copiarse).

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

---

## Tarea de hoy

> _[Describe aquí la modificación, implementación, o adjunta la imagen a recrear]_
