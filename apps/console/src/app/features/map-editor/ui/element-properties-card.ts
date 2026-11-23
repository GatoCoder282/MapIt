import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import type { SpaceElement } from '@mapit/map-engine';
import { ElementTypeIconComponent } from '@mapit/ui-kit';
import { LucideRefreshCw } from '@lucide/angular';

import { MapEditorStore } from '../model/map-editor-store';
import { STRINGS } from '../../../core/strings';

type GeometryField = 'x' | 'y' | 'width' | 'height' | 'rotation';

@Component({
  selector: 'mapit-element-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideRefreshCw, ElementTypeIconComponent],
  template: `
    <aside class="props-card" aria-label="{{ strings.properties }}">
      <header class="props-header">
        <span class="props-avatar" [attr.data-type]="element().type" aria-hidden="true">
          <mapit-element-type-icon [type]="element().type" [size]="34" />
        </span>
        <div>
          <span class="props-title">{{ element().label }}</span>
          <small>{{ typeLabels[element().type] }}</small>
        </div>
      </header>

      @if (store.canEditMetadata()) {
        <div class="props-section metadata-editor" data-testid="element-metadata">
          <h4>{{ strings.metadataTitle }}</h4>
          <label
            >{{ strings.metadataLabel }}
            <input
              data-testid="element-metadata-label"
              type="text"
              name="elementName"
              autocomplete="off"
              maxlength="120"
              [disabled]="store.busy() || store.loading()"
              [value]="metadataDraft().label"
              (input)="setLabel($event)"
              (blur)="applyMetadataDraft()"
            />
          </label>
          @if (element().reservable) {
            <label
              >{{ strings.metadataCapacity }}
              <input
                data-testid="element-metadata-capacity"
                name="elementCapacity"
                autocomplete="off"
                type="number"
                min="1"
                step="1"
                [disabled]="store.busy() || store.loading()"
                [value]="metadataDraft().capacity"
                (input)="setCapacity($event)"
                (blur)="applyMetadataDraft()"
              />
            </label>
          }
          @if (store.metadataError()) {
            <p role="alert" data-testid="element-metadata-error">{{ store.metadataError() }}</p>
          }
          <div class="metadata-actions">
            <button
              data-testid="element-metadata-clear"
              type="button"
              [disabled]="store.busy() || store.loading()"
              (click)="store.clearElementMetadata(element().id)"
            >
              {{ element().reservable ? strings.metadataClear : strings.metadataClearName }}
            </button>
            <button
              data-testid="element-metadata-save"
              type="button"
              [disabled]="store.busy() || store.loading() || !metadataDirty()"
              (click)="applyMetadataDraft()"
            >
              {{ strings.metadataSave }}
            </button>
          </div>
        </div>
      }

      <div class="props-section">
        <h4>{{ strings.position }}</h4>
        <div class="chips">
          <label class="chip chip-x">
            <span>X:</span>
            <input
              type="number"
              [disabled]="!store.canEditMetadata() || store.busy() || store.loading()"
              data-testid="map-element-x"
              [value]="geometryValue('x')"
              (input)="setGeometry('x', $event)"
              (change)="applyGeometryDraft()"
              (blur)="applyGeometryDraft()"
            />
          </label>
          <label class="chip chip-y">
            <span>Y:</span>
            <input
              type="number"
              [disabled]="!store.canEditMetadata() || store.busy() || store.loading()"
              [value]="geometryValue('y')"
              (input)="setGeometry('y', $event)"
              (change)="applyGeometryDraft()"
              (blur)="applyGeometryDraft()"
            />
          </label>
        </div>
      </div>

      <div class="props-section">
        <h4>{{ strings.size }}</h4>
        <div class="chips">
          <label class="chip">
            <span>{{ strings.sectorWidth }}</span>
            <input
              type="number"
              min="20"
              [disabled]="!store.canEditMetadata() || store.busy() || store.loading()"
              [value]="geometryValue('width')"
              (input)="setGeometry('width', $event)"
              (change)="applyGeometryDraft()"
              (blur)="applyGeometryDraft()"
            />
          </label>
          <label class="chip">
            <span>{{ strings.sectorHeight }}</span>
            <input
              type="number"
              min="20"
              [disabled]="!store.canEditMetadata() || store.busy() || store.loading()"
              [value]="geometryValue('height')"
              (input)="setGeometry('height', $event)"
              (change)="applyGeometryDraft()"
              (blur)="applyGeometryDraft()"
            />
          </label>
        </div>
      </div>

      <div class="props-section">
        <h4>{{ strings.rotation }}</h4>
        <div class="chips">
          <label class="chip">
            <input
              type="number"
              step="15"
              [attr.aria-label]="strings.rotation"
              [disabled]="!store.canEditMetadata() || store.busy() || store.loading()"
              [value]="geometryValue('rotation')"
              (input)="setGeometry('rotation', $event)"
              (change)="applyGeometryDraft()"
              (blur)="applyGeometryDraft()"
            />
            <span>°</span>
          </label>
          <button
            class="btn-rotate"
            type="button"
            [disabled]="!store.canEditMetadata() || store.busy() || store.loading()"
            aria-label="{{ strings.rotation }}"
            (click)="resetRotation()"
          >
            <svg lucideRefreshCw class="rotate-icon" aria-hidden="true"></svg>
          </button>
        </div>
      </div>

      @if (store.canEditMetadata()) {
        <button
          class="btn-delete"
          type="button"
          [disabled]="store.busy() || store.loading()"
          (click)="onDelete()"
        >
          {{ floorStrings.deleteElement }}
        </button>
      }
    </aside>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .props-card {
      display: grid;
      gap: 1rem;
      color: var(--mapit-color-text);
    }
    .props-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding-block-end: 0.875rem;
      border-bottom: 1px solid var(--mapit-color-border);
    }
    .props-header > div {
      min-width: 0;
    }
    .props-header small {
      display: block;
      margin-top: 0.125rem;
      color: var(--mapit-color-text-variant);
      font: var(--mapit-text-metadata);
    }
    .props-avatar {
      flex: none;
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      background: var(--mapit-editor-selection-soft);
      color: var(--mapit-editor-selection);
    }
    .props-title {
      font: 750 1rem / 1.3 var(--mapit-font-display);
      overflow-wrap: anywhere;
    }
    .props-section h4 {
      margin: 0 0 0.5rem;
      font: var(--mapit-text-body-bold);
    }
    .metadata-editor {
      display: grid;
      gap: 0.75rem;
    }
    .metadata-editor label {
      display: grid;
      gap: 0.25rem;
      color: var(--mapit-color-text-variant);
      font: var(--mapit-text-metadata);
    }
    .metadata-editor h4 {
      display: none;
    }
    .metadata-editor input {
      box-sizing: border-box;
      width: 100%;
      min-height: 2.5rem;
      padding: 0.5rem 0.625rem;
      border: 1px solid var(--mapit-color-border-input);
      border-radius: 0.5rem;
      background: var(--mapit-color-surface);
      color: var(--mapit-color-text);
      font: var(--mapit-text-body-bold);
    }
    .metadata-editor p {
      margin: 0;
      color: var(--mapit-color-error);
    }
    .metadata-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    button {
      min-height: 2.5rem;
      padding: 0.375rem 0.625rem;
      border: 1px solid var(--mapit-color-border-input);
      border-radius: 0.5rem;
      background: var(--mapit-color-surface);
      color: var(--mapit-color-primary-hover);
      font: var(--mapit-text-metadata);
      font-weight: 650;
      cursor: pointer;
      touch-action: manipulation;
    }
    button:not(:disabled):hover {
      background: var(--mapit-editor-selection-soft);
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .metadata-actions button {
      flex: 1;
    }
    .metadata-actions button:last-child {
      background: var(--mapit-editor-selection-soft);
      border-color: var(--mapit-editor-selection);
    }
    :is(input, button):focus-visible {
      outline: 2px solid var(--mapit-editor-selection);
      outline-offset: 2px;
    }
    .chips {
      display: flex;
      gap: 0.625rem;
    }
    .chip {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem;
      border: 1px solid var(--mapit-color-border-input);
      border-radius: 0.5rem;
      background: var(--mapit-color-surface);
      font: var(--mapit-text-body-bold);
    }
    .chip span {
      color: var(--mapit-color-text-variant);
      font: var(--mapit-text-metadata);
    }
    .chip input {
      width: 100%;
      min-width: 0;
      min-height: 1.375rem;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
    }
    .chip:focus-within {
      outline: 2px solid var(--mapit-editor-selection);
      outline-offset: 1px;
    }
    .chip input:focus-visible {
      outline: 0;
    }
    .btn-rotate {
      flex: none;
      display: grid;
      place-items: center;
      width: 2.625rem;
      padding: 0.5rem;
    }
    .rotate-icon {
      width: 1rem;
      height: 1rem;
    }
    .btn-delete {
      color: var(--mapit-color-error);
      margin-top: 0.25rem;
    }
  `,
})
export class ElementPropertiesCardComponent {
  protected readonly typeLabels = STRINGS.spaces.elements.types;
  readonly element = input.required<SpaceElement>();

  protected readonly store = inject(MapEditorStore);
  protected readonly strings = STRINGS.spaces.editor;
  protected readonly floorStrings = STRINGS.spaces.floorEditor;
  private readonly savedMetadata = computed(
    () => ({
      id: this.element().id,
      label: this.store.selectedMetadata()?.label ?? '',
      capacity: this.store.selectedMetadata()?.capacity?.toString() ?? '',
    }),
    {
      equal: (previous, next) =>
        previous.id === next.id &&
        previous.label === next.label &&
        previous.capacity === next.capacity,
    },
  );
  protected readonly metadataDraft = linkedSignal(() => {
    const { label, capacity } = this.savedMetadata();
    return { label, capacity };
  });
  protected readonly metadataDirty = computed(() => {
    if (!this.store.canEditMetadata()) return false;
    const saved = this.store.selectedMetadata();
    const draft = this.metadataDraft();
    return (
      draft.label !== (saved?.label ?? '') || draft.capacity !== (saved?.capacity?.toString() ?? '')
    );
  });

  private readonly elementId = computed(() => this.element().id);
  private readonly geometryDraft = linkedSignal<string, Partial<Record<GeometryField, string>>>({
    source: this.elementId,
    computation: () => ({}),
  });
  private readonly geometry = computed(() => {
    const el = this.element();
    return {
      ...(this.store.selectedElementPosition() ?? el.position),
      ...el.size,
      rotation: el.rotation,
    };
  });
  readonly geometryDirty = computed(() =>
    Object.entries(this.geometryDraft()).some(
      ([field, value]) => !value || Number(value) !== this.geometry()[field as GeometryField],
    ),
  );
  readonly dirty = computed(() => this.metadataDirty() || this.geometryDirty());

  applyMetadataDraft(): boolean {
    if (!this.metadataDirty()) return true;
    if (this.store.busy() || this.store.loading()) return false;
    const draft = this.metadataDraft();
    this.store.saveElementMetadata(
      this.element().id,
      draft.label,
      this.element().reservable ? draft.capacity : '',
    );
    return !this.store.metadataError();
  }

  discardDraft(): void {
    const { label, capacity } = this.savedMetadata();
    this.metadataDraft.set({ label, capacity });
    this.geometryDraft.set({});
  }

  protected setLabel(event: Event): void {
    this.metadataDraft.update((draft) => ({
      ...draft,
      label: (event.target as HTMLInputElement).value,
    }));
  }
  protected setCapacity(event: Event): void {
    this.metadataDraft.update((draft) => ({
      ...draft,
      capacity: (event.target as HTMLInputElement).value,
    }));
  }

  protected geometryValue(field: GeometryField): string | number {
    return this.geometryDraft()[field] ?? this.geometry()[field];
  }

  protected setGeometry(field: GeometryField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.geometryDraft.update((draft) => ({ ...draft, [field]: value }));
  }

  applyGeometryDraft(): boolean {
    if (this.geometryDirty()) {
      if (this.store.busy() || this.store.loading()) return false;
      const draft = this.geometryDraft();
      const geometry = { ...this.geometry() };
      for (const field of Object.keys(draft) as GeometryField[]) {
        const value = draft[field];
        if (!value || !Number.isFinite(Number(value))) return false;
        geometry[field] = Number(value);
      }
      const { x, y, width, height, rotation } = geometry;
      this.store.resizeElement(
        this.element().id,
        x,
        y,
        width,
        height,
        ((rotation % 360) + 360) % 360,
      );
    }
    this.geometryDraft.set({});
    return true;
  }

  protected resetRotation(): void {
    this.geometryDraft.update((draft) => ({ ...draft, rotation: '0' }));
    this.applyGeometryDraft();
  }

  /** Destructivo: pide confirmación (guía web). */
  protected onDelete(): void {
    if (this.store.busy() || this.store.loading()) return;
    this.store.confirmDeleteElement(this.element().id);
  }
}
