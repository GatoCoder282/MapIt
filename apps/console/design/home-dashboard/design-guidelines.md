# MapIt Console — Dashboard de administrador (CU-10) · Guidelines

> Ver [design.md](design.md) para tokens. Ver [design-components.md](design-components.md) para specs.

## Accessibility

| Requisito          | Regla                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Contraste de texto | `--mapit-color-text` (#151c27) sobre superficie blanca: > 12:1. Labels muted (#6b7280) sobre blanco: 4.6:1 — cumple AA para texto pequeño. |
| Botón primario     | Blanco `#ffffff` sobre `--mapit-color-accent` (#3d4ef2): ~4.6:1 — AA.                                                                      |
| Error              | `--mapit-color-error` (#ba1a1a) sobre #fee2e2: ~6:1 — AA.                                                                                  |
| Foco               | Focus ring global del navegador + `--mapit-color-focus-ring` definido en tokens; los enlaces `<a>` y `<button>` nativos lo heredan.        |
| Roles              | Mensaje de carga `role="status"`; error `role="alert"`.                                                                                    |
| Encabezados        | Un `<h1>` por página; secciones con `<h2>`.                                                                                                |

## Do's and Don'ts

### Datos

- **Do** mostrar solo métricas respaldadas por el contrato (`listTenants`, `listEstablishments`).
- **Don't** renderizar cifras de la imagen de referencia como si fueran reales (248, 1.842… son datos ficticios del mock).

### Color

- **Do** usar los tokens de marca (índigo #1c2edb / #3d4ef2) para CTAs y énfasis.
- **Don't** importar el azul del editor (#2563EB) en elementos que no sean selección del lienzo del editor.

### Motion

- **Do** mantener hover/press sutiles con `--mapit-duration-fast` (150ms).
- **Don't** añadir entradas animadas, GSAP o Lenis a este dashboard (veredicto `find-animation-opportunities`: sin motion nueva).

### Contenido

- **Do** todo texto visible desde `STRINGS` (`adminDashboardHome`), tipado.
- **Don't** strings hardcodeados en el componente ni etiquetas ambiguas ("ver más" sin destino).

## Pendiente de definir (honesto, no inventado)

- Estados hover de la fila de distribución (hoy no es interactiva; si se vuelve clicable, añadir hover + foco).
- Modo oscuro: el bloque `prefers-color-scheme` está removido de los tokens hasta que el sistema defina la paleta dark.
- Comportamiento sin datos de sesión (eyebrow oculto; título e intro siempre visibles).
