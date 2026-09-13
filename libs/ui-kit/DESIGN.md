---
name: MapIt
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daea'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eefe'
  surface-container-high: '#e2e8f8'
  surface-container-highest: '#dce2f3'
  on-surface: '#151c27'
  on-surface-variant: '#454656'
  inverse-surface: '#2a313d'
  inverse-on-surface: '#ebf1ff'
  outline: '#757687'
  outline-variant: '#c5c5d8'
  surface-tint: '#3547ec'
  primary: '#1c2edb'
  on-primary: '#ffffff'
  primary-container: '#3d4ef2'
  on-primary-container: '#dfe0ff'
  inverse-primary: '#bdc2ff'
  secondary: '#5c5f60'
  on-secondary: '#ffffff'
  secondary-container: '#dee0e2'
  on-secondary-container: '#606365'
  tertiary: '#8a2d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#b23d00'
  on-tertiary-container: '#ffdace'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dfe0ff'
  primary-fixed-dim: '#bdc2ff'
  on-primary-fixed: '#000766'
  on-primary-fixed-variant: '#1025d5'
  secondary-fixed: '#e1e2e4'
  secondary-fixed-dim: '#c5c7c8'
  on-secondary-fixed: '#191c1e'
  on-secondary-fixed-variant: '#444749'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59a'
  on-tertiary-fixed: '#380d00'
  on-tertiary-fixed-variant: '#802a00'
  background: '#f9f9ff'
  on-background: '#151c27'
  surface-variant: '#dce2f3'
typography:
  display-title:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  section-title:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-md-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  metadata:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  sidebar_width: 280px
  topbar_height: 64px
  gutter: 16px
  margin_page: 24px
  stack_sm: 8px
  stack_md: 12px
---

## Marca y estilo

Sistema diseñado para entornos operativos de alta exigencia: gestión de espacios en
tiempo real para B2B. Estética de **"torre de control de aeropuerto"**: claridad,
precisión y procesamiento rápido de información por encima de lo decorativo.

El estilo visual es **corporativo / moderno**, con estructura muy marcada y profundidad
sutil. Se evita el ruido visual (nada de neones ni morados) para que la atención del
usuario se mantenga en los datos espaciales y los cambios de estado en tiempo real.
La respuesta emocional buscada: control, fiabilidad y eficiencia profesional.

## Colores

La paleta se ancla en un blanco puro (`#FFFFFF`) como base para maximizar la legibilidad.

- **Índigo primario:** solo para CTAs primarios, estados activos de navegación y puntos
  críticos de interacción.
- **Grises secundarios:** `#F7F8FA` como fondo de sidebars y paneles secundarios, para
  crear contraste estructural suave sin líneas duras.
- **Mapeo semántico:** lógica estricta de cuatro estados para todos los elementos del
  mapa. Cada estado usa un color de trazo/icono de alto contraste sobre un color de
  superficie desaturado y de alta luminancia, para que el mapa siga siendo legible
  aunque esté muy poblado.

## Tipografía

Estrategia de doble fuente:

- **Manrope** para títulos y encabezados: aporta un aire técnico, moderno y geométrico.
- **Inter** para todo el texto funcional de UI, tablas de datos y cuerpo: legibilidad
  excepcional en tamaños pequeños y tono "neutro-frío".

La escala tipográfica es deliberadamente compacta, coherente con la densidad de datos
de una herramienta B2B de gestión. Los metadatos usan siempre el tinte `#6B7280` para
mantener la jerarquía visual entre contenido primario y detalles secundarios.

## Layout y espaciado

El layout sigue un modelo de **sidebar fijo**, que actúa como ancla persistente para la
navegación global y los filtros de espacio.

- **Contenedor principal:** fluido, con padding interno mínimo de 24px.
- **Sidebar (280px):** aloja la jerarquía organizativa y los filtros de alto nivel.
- **Grid:** rejilla base de 4px para todo el espaciado interno de componentes
  (padding/margin), garantizando un ritmo vertical matemáticamente consistente.
- **Vista de mapa:** el workspace central maximiza el viewport; las acciones
  secundarias del mapa (zoom, capas) usan toolbars flotantes en lugar de paneles
  fijos, para no desperdiciar espacio en pantalla.

## Elevación y profundidad

La elevación se transmite mediante **capas tonales** y **sombras ambientales**, no
mediante bordes.

1. **Nivel 0 (base):** `#F7F8FA` — el "lienzo" de fondo.
2. **Nivel 1 (paneles/sidebar):** `#FFFFFF` — superficies elevadas para el sidebar y
   los contenedores principales de datos.
3. **Nivel 2 (tarjetas/flotantes):** `#FFFFFF` con sombra suave y difusa
   (`0px 4px 12px rgba(0, 0, 0, 0.05)`). Para tooltips del mapa y detalles del
   espacio activo.

Evitar negro puro y bordes de alto contraste; usar trazos de 1px de `#E5E7EB` solo
cuando sea necesario separar elementos sobre fondos idénticos.

## Formas

El lenguaje de formas equilibra lo "técnico" con la accesibilidad moderna.

- **Tarjetas y botones:** radio de 8px a 12px. Los botones grandes tienden a 12px para
  un tacto interactivo más cercano.
- **Inputs y componentes pequeños:** radio de 4px. La esquina más afilada indica
  utilidad de alta densidad y entrada de datos.
- **Elementos del mapa:** los espacios (mesas, salas, zonas) se renderizan como bloques
  geométricos simplificados (rectángulos o círculos) con radio de esquina de 4px,
  manteniendo el lenguaje visual de los componentes de UI.
- **Iconos:** trazo consistente de 1.5px con terminales redondeados.

## Componentes

- **Botones primarios:** relleno sólido `#3D4EF2`, texto blanco, radio 12px.
  Sin gradientes.
- **Chips de estado:** fondo con el color semántico de superficie; texto y punto
  indicador de 1.5px con el color semántico principal. Las etiquetas deben ser de alto
  contraste para la legibilidad del mapa.
- **Inputs:** fondo blanco, borde 1px (`#D1D5DB`), radio 4px. En foco, halo exterior
  de 2px del índigo primario al 20% de opacidad.
- **Tarjetas:** fondo blanco, sin borde, sombra de nivel 2, radio 12px.
- **Nav del sidebar:** el estado activo usa un indicador vertical en "píldora" de 4px
  en el borde izquierdo, en índigo primario, con fondo de fila en tinte índigo claro
  (`#EEF0FF`).
- **Marcadores del mapa:** formas geométricas simples con trazo de 1.5px. El color del
  trazo es el color semántico "principal" y el relleno es el color semántico de
  "superficie".

---

## Resuelto en la implementación

- **Índigo canónico:** `primary #1c2edb` (heredado del login en producción) como color de
  texto/acento y `primary-container #3d4ef2` como relleno de botones. El antiguo
  `#3b82f6` de `_tokens.scss` queda retirado. Sin violetas: los acentos violeta de las
  referencias externas se traducen siempre al índigo de Marca.
- **Fuentes:** Manrope (titulares) e Inter (UI) instaladas vía `@fontsource-variable/*`
  en `apps/console`, servidas localmente sin dependencia externa.
- **Fondo base:** se adopta `#F7F8FA` como lienzo (Level 0), según la sección de
  elevación. Los tonos azulados `#f9f9ff`/`#f0f3ff` quedan como superficies de apoyo
  (`surface-low`), no como fondo de página.

## Pendiente de resolver con el equipo de diseño

Estos puntos no están definidos en la fuente original y **no deben improvisarse**
al implementar:

- **Valores hex de los 4 estados semánticos del mapa** (color principal + superficie de
  cada uno). Deben casarse con los 5 tokens `--mapit-state-*` ya existentes en
  `libs/ui-kit/styles/_tokens.scss` (hay 5 estados en código: disponible, ocupado,
  reservado, limpieza, fuera de servicio).
- **Modo oscuro:** el theme actual de `_tokens.scss` lo define; este documento no.
  Habrá que derivar la escala inversa (`inverse-surface`, etc.) o eliminarlo.
- **Estados hover/active de botones y nav** más allá del focus de inputs.
