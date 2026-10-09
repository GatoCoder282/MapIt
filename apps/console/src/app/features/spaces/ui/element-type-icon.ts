import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Miniatura SVG compuesta de un tipo de elemento espacial (HU-4.02, nivel 2).
 *
 * Cada tipo de {@code SpaceElementType} tiene un pictograma construido con formas
 * simples (mesas con sillas, filas de asientos, barra con taburetes…), al estilo de
 * las paletas de objetos de los planificadores de espacios. Es puramente
 * presentacional: no conoce stores ni el api-client.
 */
@Component({
  selector: 'mapit-element-type-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size() * 0.75"
      viewBox="0 0 64 48"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (type()) {
        @case ('TABLE') {
          <!-- Mesa redonda con 4 sillas -->
          <circle cx="32" cy="24" r="9" />
          <rect x="27" y="5" width="10" height="5" rx="1.5" />
          <rect x="27" y="38" width="10" height="5" rx="1.5" />
          <rect x="9" y="19" width="5" height="10" rx="1.5" />
          <rect x="50" y="19" width="5" height="10" rx="1.5" />
        }
        @case ('BAR') {
          <!-- Barra alargada con taburetes -->
          <rect x="10" y="10" width="44" height="10" rx="3" />
          <circle cx="18" cy="35" r="4" />
          <circle cx="32" cy="35" r="4" />
          <circle cx="46" cy="35" r="4" />
        }
        @case ('SEAT') {
          <!-- Filas de asientos numerados -->
          <rect x="12" y="8" width="10" height="8" rx="2" />
          <rect x="27" y="8" width="10" height="8" rx="2" />
          <rect x="42" y="8" width="10" height="8" rx="2" />
          <rect x="12" y="21" width="10" height="8" rx="2" />
          <rect x="27" y="21" width="10" height="8" rx="2" />
          <rect x="42" y="21" width="10" height="8" rx="2" />
          <rect x="12" y="34" width="10" height="8" rx="2" />
          <rect x="27" y="34" width="10" height="8" rx="2" />
          <rect x="42" y="34" width="10" height="8" rx="2" />
        }
        @case ('ROOM') {
          <!-- Habitación con puerta -->
          <path d="M12 42 V8 h40 v14" />
          <path d="M52 30 v12 H12" />
          <path d="M42 42 v-8 a4 4 0 0 1 8 0" />
        }
        @case ('STAGE') {
          <!-- Escenario elevado con escalones -->
          <rect x="12" y="10" width="40" height="16" rx="2" />
          <path d="M18 26 v6 h10" />
          <path d="M24 32 v6" />
          <path d="M12 38 h40" />
        }
        @case ('SECTOR_ZONE') {
          <!-- Zona demarcada de línea punteada -->
          <rect x="10" y="10" width="44" height="28" rx="3" stroke-dasharray="5 4" />
          <circle cx="32" cy="24" r="4" />
        }
        @case ('DECOR') {
          <!-- Elemento decorativo (planta) -->
          <path d="M32 40 v-12" />
          <circle cx="32" cy="22" r="7" />
          <circle cx="24" cy="30" r="5" />
          <circle cx="40" cy="30" r="5" />
          <path d="M26 40 h12 l-2 5 h-8 z" />
        }
        @default {
          <rect x="16" y="12" width="32" height="24" rx="3" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      color: var(--mapit-color-text-muted);
    }
  `,
})
export class ElementTypeIconComponent {
  /** Tipo de elemento: TABLE, BAR, SEAT, ROOM, STAGE, SECTOR_ZONE o DECOR. */
  readonly type = input.required<string>();
  readonly size = input(40);
}
