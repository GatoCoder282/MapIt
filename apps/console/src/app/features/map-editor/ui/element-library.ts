import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { ElementTypeIconComponent } from '@mapit/ui-kit';

import { STRINGS } from '../../../core/strings';
import { MapEditorStore, TYPE_DEFAULTS } from '../model/map-editor-store';
import type { SpaceElementType } from '@mapit/map-engine';

interface LibraryCard {
  /** `base:<TYPE>` para estructuras base, `tpl:<id>` para plantillas guardadas. */
  key: string;
  type: string;
  label: string;
}

interface LibraryCategory {
  key: string;
  label: string;
  cards: LibraryCard[];
}

/**
 * Biblioteca de estructuras y plantillas insertables en el canvas del sector.
 *
 * Reemplaza al formulario manual de coordenadas: cada tarjeta puede arrastrarse
 * al lienzo (drop lo captura el puerto de mapa vía `onExternalDrop`, que crea el
 * elemento en ese punto) o pulsarse para crear el elemento en el centro del sector.
 * La creación es el alta de siempre (POST elements) vía {@link MapEditorStore}.
 */
@Component({
  selector: 'mapit-element-library',
  imports: [ElementTypeIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="library" [attr.aria-label]="paletteStrings.title">
      <p class="library-title">{{ paletteStrings.title }}</p>
      <p class="library-hint">{{ strings.hint }}</p>

      @if (store.templatesLoading()) {
        <p class="library-state">{{ paletteStrings.loading }}</p>
      }

      @for (category of categories(); track category.key) {
        <div class="category">
          <p class="category-label">{{ category.label }}</p>
          <div class="cards" role="listbox" [attr.aria-label]="category.label">
            @for (card of category.cards; track card.key) {
              <button
                type="button"
                class="card"
                role="option"
                [attr.aria-selected]="false"
                [class.base]="card.key.startsWith('base:')"
                draggable="true"
                (dragstart)="onDragStart($event, card.key)"
                (click)="insertAtCenter(card.key)"
              >
                <mapit-element-type-icon [type]="card.type" [size]="44" />
                <span class="card-label">{{ card.label }}</span>
              </button>
            }
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .library {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .library-title {
      margin: 0;
      font-size: 0.8125rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--mapit-color-text-muted);
    }

    .library-hint {
      margin: -0.5rem 0 0;
      font-size: 0.75rem;
      color: var(--mapit-color-text-muted);
    }

    .library-state {
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
      grid-template-columns: repeat(3, minmax(0, 1fr));
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
      cursor: grab;
      transition:
        border-color 150ms ease,
        box-shadow 150ms ease,
        color 150ms ease;
    }
    .card:active {
      cursor: grabbing;
    }
    .card:hover {
      border-color: var(--mapit-color-primary);
      color: var(--mapit-color-text);
    }
    .card:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--mapit-color-focus-ring);
    }
    .card.base {
      border-style: dashed;
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
export class ElementLibraryComponent implements OnInit {
  protected readonly store = inject(MapEditorStore);
  protected readonly paletteStrings = STRINGS.spaces.templates.palette;
  protected readonly strings = STRINGS.spaces.editor.library;
  private readonly typeStrings = STRINGS.spaces.elements.types;

  /** Agrupación visual de tipos en categorías; el orden es estable. */
  private readonly categoryOrder: ReadonlyArray<{ key: string; types: SpaceElementType[] }> = [
    { key: 'tablesBars', types: ['TABLE', 'BAR'] },
    { key: 'seatsRooms', types: ['SEAT', 'ROOM'] },
    { key: 'zonesStages', types: ['SECTOR_ZONE', 'STAGE'] },
    { key: 'decor', types: ['DECOR'] },
  ];

  protected readonly categories = computed<LibraryCategory[]>(() => {
    const templates = this.store.templates();
    const labels = this.paletteStrings.categories;
    // HU-7.01/7.02 (MAP-247): solo los tipos que admite la vertical del sector, y solo las
    // plantillas de esos tipos. Una categoría sin tipos admitidos desaparece.
    return this.categoryOrder.flatMap(({ key, types }) => {
      const allowed = types.filter((type) => this.store.isTypeAllowed(type));
      if (allowed.length === 0) return [];
      const cards: LibraryCard[] = allowed.flatMap((type) => {
        const base: LibraryCard = {
          key: `base:${type}`,
          type,
          label: this.typeStrings[type] ?? type,
        };
        const saved = templates
          .filter((t) => t.type === type)
          .map((t) => ({ key: `tpl:${t.id}`, type: t.type, label: t.name }));
        return [base, ...saved];
      });
      return [{ key, label: labels[key as keyof typeof labels] ?? key, cards }];
    });
  });

  ngOnInit(): void {
    this.store.loadTemplates();
  }

  /** Arrastre hacia el canvas; el puerto de mapa convierte el drop en coordenadas. */
  protected onDragStart(event: DragEvent, key: string): void {
    event.dataTransfer?.setData('text/plain', key);
    event.dataTransfer?.setData('text', key);
  }

  /** Click/teclado: crea el elemento centrado en el sector actual. */
  protected insertAtCenter(key: string): void {
    const size = this.store.sectorSize();
    const type = this.resolveType(key);
    const defaults = type ? TYPE_DEFAULTS[type] : undefined;
    const x = size.width / 2 - (defaults?.size.width ?? 0) / 2;
    const y = size.height / 2 - (defaults?.size.height ?? 0) / 2;
    this.store.createElementFromDrop(key, x, y);
  }

  private resolveType(key: string): SpaceElementType | null {
    if (key.startsWith('base:')) {
      const candidate = key.slice(5);
      return this.categoryOrder.flatMap((c) => c.types).find((t) => t === candidate) ?? null;
    }
    if (key.startsWith('tpl:')) {
      return this.store.templates().find((t) => t.id === key.slice(4))?.type ?? null;
    }
    return null;
  }
}
