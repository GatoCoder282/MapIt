import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  output,
} from '@angular/core';

import { STRINGS } from '../../../core/strings';
import { TemplatesStore } from '../model/templates-store';
import { ElementTypeIconComponent } from './element-type-icon';

interface PaletteCard {
  /** Id de la plantilla guardada; null para la estructura base del tipo. */
  templateId: string | null;
  type: string;
  label: string;
}

interface PaletteCategory {
  key: string;
  label: string;
  cards: PaletteCard[];
}

/**
 * Paleta visual de estructuras y plantillas de elemento (HU-4.02, niveles 1 y 2).
 *
 * Muestra, agrupadas por categoría, las estructuras posibles (una tarjeta por tipo de
 * `SpaceElementType`, siempre disponibles) y las plantillas guardadas del tenant (con su
 * nombre), cada una con su miniatura. Un click aplica la elección:
 *
 * - Tarjeta de estructura base → `clicked` con `type` y `templateId: null`.
 * - Tarjeta de plantilla → queda seleccionada en {@link TemplatesStore} y `clicked`
 *   lleva su `type`, para que el formulario pre-rellene el tipo.
 *
 * El panel es puramente de selección visual: no crea instancias ni llama al API por sí
 * mismo (la creación sigue el flujo normal del formulario de elemento).
 */
@Component({
  selector: 'mapit-template-palette',
  imports: [ElementTypeIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="palette" [attr.aria-label]="paletteStrings.title">
      <p class="palette-title">{{ paletteStrings.title }}</p>
      <p class="palette-hint">{{ paletteStrings.hint }}</p>

      @if (store.loading()) {
        <p class="palette-state">{{ paletteStrings.loading }}</p>
      }

      @for (category of categories(); track category.key) {
        <div class="category">
          <p class="category-label">{{ category.label }}</p>
          <div class="cards" role="listbox" [attr.aria-label]="category.label">
            @for (card of category.cards; track card.templateId ?? card.type) {
              <button
                type="button"
                class="card"
                role="option"
                [class.selected]="isSelected(card)"
                [class.base]="card.templateId === null"
                [disabled]="store.loading()"
                [attr.aria-selected]="isSelected(card)"
                (click)="pick(card)"
              >
                <mapit-element-type-icon [type]="card.type" [size]="44" />
                <span class="card-label">{{ card.label }}</span>
              </button>
            }
          </div>
        </div>
      }

      @if (!store.loading() && store.templates().length === 0) {
        <p class="palette-state">{{ paletteStrings.empty }}</p>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .palette {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius);
    }

    .palette-title {
      margin: 0;
      font-size: 0.8125rem;
      font-weight: 700;
      color: var(--mapit-color-text);
    }

    .palette-hint {
      margin: -0.5rem 0 0;
      font-size: 0.75rem;
      color: var(--mapit-color-text-muted);
    }

    .palette-state {
      margin: 0;
      font-size: 0.75rem;
      color: var(--mapit-color-text-muted);
    }

    .category {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .category-label {
      margin: 0;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--mapit-color-text-muted);
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
      gap: 0.375rem;
    }

    .card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      padding: 0.5rem 0.25rem;
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius-input);
      background: var(--mapit-color-surface);
      color: var(--mapit-color-text-muted);
      font: inherit;
      cursor: pointer;
      transition:
        border-color 150ms ease,
        box-shadow 150ms ease,
        color 150ms ease;
    }
    .card:hover:not(:disabled) {
      border-color: var(--mapit-color-text-muted);
      color: var(--mapit-color-text);
    }
    .card:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--mapit-color-focus-ring);
    }
    .card.selected {
      border-color: var(--mapit-color-primary);
      color: var(--mapit-color-primary);
      box-shadow: 0 0 0 1px var(--mapit-color-primary);
    }
    .card.base {
      border-style: dashed;
    }
    .card:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .card-label {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.6875rem;
      font-weight: 600;
    }
  `,
})
export class TemplatePaletteComponent {
  /**
   * Notifica la elección del usuario. `templateId` es null para estructuras base;
   * el formulario decide cómo aplicar el `type` al borrador del elemento.
   */
  readonly clicked = output<{ templateId: string | null; type: string }>();

  protected readonly store = inject(TemplatesStore);
  protected readonly paletteStrings = STRINGS.spaces.templates.palette;
  protected readonly typeStrings = STRINGS.spaces.elements.types;

  /**
   * Agrupación de tipos en categorías visuales, al estilo de las paletas de
   * referencia ("Desks", "Points of interest"). El orden de las categorías y de
   * los tipos dentro de cada una es estable.
   */
  private readonly categoryOrder: ReadonlyArray<{ key: string; types: string[] }> = [
    { key: 'tablesBars', types: ['TABLE', 'BAR'] },
    { key: 'seatsRooms', types: ['SEAT', 'ROOM'] },
    { key: 'zonesStages', types: ['SECTOR_ZONE', 'STAGE'] },
    { key: 'decor', types: ['DECOR'] },
  ];

  protected readonly categories = computed<PaletteCategory[]>(() => {
    const templates = this.store.templates();
    const labels = this.paletteStrings.categories;
    return this.categoryOrder.map(({ key, types }) => {
      const cards: PaletteCard[] = types.flatMap((type) => {
        const base: PaletteCard = {
          templateId: null,
          type,
          label: this.typeStrings[type as keyof typeof this.typeStrings] ?? type,
        };
        const saved = templates
          .filter((t) => t.type === type)
          .map((t) => ({ templateId: t.id, type: t.type, label: t.name }));
        return [base, ...saved];
      });
      return { key, label: labels[key as keyof typeof labels] ?? key, cards };
    });
  });

  constructor() {
    effect(() => {
      this.store.loadTemplates();
    });
  }

  protected isSelected(card: PaletteCard): boolean {
    const selected = this.store.selectedTemplate();
    if (card.templateId !== null) {
      return selected?.id === card.templateId;
    }
    // La estructura base queda marcada cuando no hay plantilla seleccionada y su
    // tipo coincide con el último aplicado vía `clicked` lo decide el formulario;
    // aquí solo reflejamos "sin plantilla" para no marcar nada por defecto.
    return false;
  }

  protected pick(card: PaletteCard): void {
    if (card.templateId === null) {
      this.store.clearSelection();
    } else {
      this.store.selectTemplate(card.templateId);
    }
    this.clicked.emit({ templateId: card.templateId, type: card.type });
  }
}
