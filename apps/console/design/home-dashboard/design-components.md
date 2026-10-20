# MapIt Console — Dashboard de administrador (CU-10) · Component Specs

> Specs de los componentes implementados en `apps/console/src/app/features/home/home.ts`.
> Para tokens ver [design.md](design.md). Para reglas y accesibilidad ver [design-guidelines.md](design-guidelines.md).

## Data Display

### Tarjeta KPI

| Propiedad  | Valor                                                                     |
| ---------- | ------------------------------------------------------------------------- |
| Contenedor | `article.card` — superficie blanca, borde 1px, radio 12px, sombra nivel 1 |
| Valor      | Manrope 2rem/700, `--mapit-color-text`                                    |
| Label      | metadata 12px, uppercase, tracking 0.05em, muted                          |
| Padding    | `--mapit-space-6` (24px)                                                  |
| Estados    | loading (hint) / error (mensaje con reintento) / datos                    |

**Do:** una métrica por tarjeta; valores reales del contrato.
**Don't:** inventar tendencias ("↑ 12% vs mes anterior") sin endpoint que las sustente.

### Fila de distribución por tipo

| Propiedad  | Valor                                                                |
| ---------- | -------------------------------------------------------------------- |
| Contenedor | `article.item` — fila flex space-between, borde 1px, radio 8px       |
| Label      | metadata 12px (nombre de la vertical desde `STRINGS.verticals`)      |
| Valor      | display numérico 2rem/700 alineado a la derecha                      |
| Orden      | fijo: RESTAURANT, NIGHTCLUB, EVENT_HALL, HOTEL (`@for … track type`) |
| Vacío      | mensaje "No hay establecimientos registrados."                       |

## Navigation

### Accesos rápidos

| Propiedad  | Valor                                                                     |
| ---------- | ------------------------------------------------------------------------- |
| Primario   | `a.btn.primary` — fondo accent, texto blanco, radio 12px; hover → primary |
| Secundario | `a.btn.secondary` — superficie blanca, borde 1px, texto normal            |
| Altura     | ~40px (padding 0.55rem 1rem + tipografía body-bold)                       |
| Rutas      | `/admin/tenants`, `/admin/settings` (RouterLink)                          |

**Do:** como son enlaces reales (`<a routerLink>`), heredan foco y teclado gratis.
**Don't:** usar `<button (click)="router.navigate()">` para navegación simple.

### Encabezado de bienvenida

| Propiedad   | Valor                                                                      |
| ----------- | -------------------------------------------------------------------------- |
| Eyebrow     | "Bienvenido de nuevo, {user.fullName}" — caps, primary                     |
| Título      | "Dashboard" — display 20/600                                               |
| Intro       | body 14/400 muted                                                          |
| Condicional | el eyebrow solo se muestra si hay sesión (`@if (session.user(); as user)`) |

## Feedback

### Mensaje de error con reintento

| Propiedad  | Valor                                                                       |
| ---------- | --------------------------------------------------------------------------- |
| Contenedor | `div.message.error` — fondo #fee2e2, texto `--mapit-color-error`, radio 8px |
| ARIA       | `role="alert"`                                                              |
| Acción     | `button.btn.secondary` "Reintentar" → vuelve a ejecutar ambas cargas        |
| Alcance    | un solo mensaje para las dos fuentes (tenants + establecimientos)           |

**Do:** reintento vuelve a disparar el `forkJoin` completo.
**Don't:** ocultar el error tras un reintento fallido; el mensaje persiste.

### Estado de carga

Texto simple `role="status"` ("Cargando resumen…"). Transitorio: con respuestas rápidas
puede no llegar a renderizarse (así es correcto; no se fuerza un skeleton).

## Widgets de la imagen de referencia NO implementados (falta de contrato)

Se documentan aquí para que nadie los "complete" inventando datos:

| Widget                           | Motivo                                                    |
| -------------------------------- | --------------------------------------------------------- |
| Usuarios registrados             | No existe `listUsers` en el contrato (solo `createUser`). |
| Reportes generados               | No hay endpoint.                                          |
| Actividad reciente               | No hay endpoint.                                          |
| Crecimiento 7 días               | No hay endpoint time series.                              |
| Mapa de distribución             | `Establishment` no expone coordenadas.                    |
| Destacados con rating            | No existe rating en el dominio.                           |
| Tendencias "↑ % vs mes anterior" | Requieren series históricas; no hay endpoint.             |

Se implementarán cuando exista contrato; cada uno con su criterio de aceptación.
