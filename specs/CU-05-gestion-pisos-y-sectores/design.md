# Design Specs: Gestión de Pisos y Sectores (CU-05)

Este documento define la fuente única de verdad para los estilos, medidas y distribución visual de la interfaz de "Estructura del espacio" (Setup Wizard - Step 2).

## 1. Design Tokens (Fundamentos)

### Colores

| Uso                  | Token / Hex                | Aplicación                                                                  |
| :------------------- | :------------------------- | :-------------------------------------------------------------------------- |
| **Primario**         | `primary-600` (`#3B5FE5`)* | Botones principales ("Siguiente"), iconos de Piso, textos de acción activa. |
| **Primario Suave**   | `primary-50` (`#EEF2FF`)   | Fondo del icono de Piso, hover sutil de botones de acción.                  |
| **Fondo Base**       | `bg-app` (`#F8FAFC`)       | Fondo general de la pantalla (fuera de la tarjeta principal).               |
| **Fondo Tarjeta**    | `bg-surface` (`#FFFFFF`)   | Fondo del contenedor principal y de la fila de Piso.                        |
| **Fondo Secundario** | `bg-muted` (`#F1F5F9`)     | Fondo de las filas de Sectores y del botón "Agregar piso".                  |
| **Texto Principal**  | `text-main` (`#0F172A`)    | Títulos ("Estructura del espacio", "Piso 1").                               |
| **Texto Secundario** | `text-muted` (`#475569`)   | Descripciones, nombres de sectores ("Salón Principal").                     |
| **Bordes**           | `border-light` (`#E2E8F0`) | Bordes de tarjetas, separadores, líneas de conexión del árbol.              |

_(Nota: El hex exacto de primario es una aproximación del azul vibrante de la imagen; ajustar con la variable de Tailwind de tu proyecto si ya existe, ej. `bg-blue-600`)._

### Tipografía y Espaciado

- **Fuente:** Inter (o la sans-serif por defecto del proyecto).
- **Radios de Borde (Border Radius):**
  - Tarjeta principal: `12px` (`rounded-xl`).
  - Filas (Pisos/Sectores) y Botones: `8px` (`rounded-lg`).
  - Badge / Pill ("Drag to reorder"): `9999px` (`rounded-full`).
- **Líneas de conexión (Árbol):** Grosor de `2px`, color `border-light` (`#E2E8F0`).

---

## 2. Especificaciones por Componente

### A. Contenedor Principal (`<piso-list>`)

La vista principal está contenida dentro de una tarjeta blanca con elevación suave o borde.

- **Padding interno:** `24px` (`p-6`).
- **Borde:** `1px solid #E2E8F0`, `border-radius: 12px`.
- **Header de la tarjeta:** Contiene el título "Pisos y Sectores" (`18px`, Semibold) y a la derecha un badge gris claro (`bg-slate-100`) con forma de píldora que dice "Drag to reorder" con un icono de información.

### B. Fila de Piso (Parent Node)

Representa un `Floor` instanciado.

- **Contenedor:** Fondo blanco (`#FFFFFF`), `border-radius: 8px`. No lleva borde exterior oscuro, pero sí un borde sutil `#E2E8F0`.
- **Layout:** Flexbox horizontal (Row), alineación vertical al centro (`items-center`), gap de `16px`.
- **Elementos internos (Izquierda a Derecha):**
  1.  **Drag handle:** Icono de 6 puntos, color `#94A3B8`.
  2.  **Icon Box:** Cuadrado de `40x40px`, fondo `#EEF2FF`, bordes redondeados `8px`, icono de capas (layers) color `#3B5FE5`.
  3.  **Texto:** Nombre del piso (ej. "Piso 1"), color `#0F172A`, font-weight `500` (Medium).
  4.  **Acciones (Derecha):** Iconos de lápiz (editar) y basurero (eliminar), color `#64748B`, que aparecen o se oscurecen al hacer hover.

### C. Fila de Sector (Child Node) - `<sector-list>`

Representa un `Sector` dentro de un `Floor`. Tienen un nivel de indentación y una jerarquía visual de árbol.

- **Indentación:** Margen izquierdo de aprox `48px` respecto al borde de la tarjeta del Piso, para dejar espacio a la línea conectora.
- **Líneas conectoras (Árbol):**
  - Una línea vertical de `2px` sólida (`#E2E8F0`) que baja desde el centro del icono del Piso.
  - Líneas horizontales cortas de `16px` de ancho que conectan la línea vertical con cada fila de Sector.
- **Contenedor:** Fondo gris muy claro (`#F8FAFC`), borde de `1px solid #E2E8F0`, `border-radius: 8px`. Padding de `12px 16px`.
- **Elementos internos:**
  1.  **Drag handle:** Icono de 6 puntos, color `#94A3B8`.
  2.  **Icono:** Depende del tipo (cubiertos para restaurante, terraza, etc.), color primario o gris oscuro.
  3.  **Texto:** "Salón Principal", "Terraza". Color `#475569`, tamaño `14px`.

### D. Botón "Agregar Sector" (`<sector-form>` trigger)

Ubicado al final de la lista de sectores de un piso.

- **Estilo:** Borde punteado (dashed) `1px` color `#CBD5E1` o el color primario con opacidad. Fondo blanco.
- **Texto:** "+ Agregar Sector", color `#3B5FE5` (Primario), tamaño `14px`, peso Medium.
- **Comportamiento:** Mantiene la indentación y la línea conectora del árbol, igual que un Sector normal.

### E. Botón "Agregar piso" (`<piso-form>` trigger)

Ubicado debajo de todos los bloques de Pisos.

- **Contenedor:** Alto de aprox `100px`, padding vertical amplio. Borde punteado grueso (dashed `2px` color `#CBD5E1`), fondo `#F8FAFC`, `border-radius: 12px`.
- **Contenido:** Centrado vertical y horizontalmente. Un círculo gris/azul claro con un "+" adentro, y debajo el texto "Agregar piso" (`14px`, Medium, color `#475569`).

---

## 3. Comportamientos y Estados (Para MVVM & Interacciones)

- **Estados Vacíos (Empty States):** Si no hay pisos creados, el contenedor principal de la lista no debe aparecer vacío; el botón "Agregar piso" debe ser el elemento central prominente.
- **Transiciones (Regla "Aporta/No Aporta"):**
  - **Entrada de listas (`@for`): APORTA.** Cuando se crea un nuevo piso o sector, usar la librería `@angular/animations` para una transición de altura (expandir) y fade-in. Esto comunica al usuario dónde se insertó el nuevo elemento en la jerarquía.
  - **Formularios inline:** Si al hacer clic en "Agregar Sector" el botón se transforma en un input, esta transición de estado debe ser inmediata o con un crossfade muy rápido (`150ms`).
- **Accesibilidad (A11y):** Asegurar que los botones de editar/eliminar y los "Drag handles" tengan `aria-label` descriptivos, ya que los iconos por sí solos no son suficientes para lectores de pantalla.

> **Nota para el agente:** Al implementar esto en `apps/console`, utiliza estrictamente la directiva `@for` y señales (`spacesState`) detalladas en el CU-05. Asegúrate de implementar la estructura de árbol visual (líneas conectoras) usando un contenedor relativo con pseudoelementos (`::before` / `::after`) o bordes a la izquierda, evitando ensuciar el HTML con divs vacíos decorativos.
