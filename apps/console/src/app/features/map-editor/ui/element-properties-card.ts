import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import type { SpaceElement } from '@mapit/map-engine';
import { LucideRefreshCw } from '@lucide/angular';

import { MapEditorStore } from '../model/map-editor-store';
import { STRINGS } from '../../../core/strings';

/**
 * Tarjeta flotante de propiedades del elemento seleccionado (HU-4.01 v2,
 * spec: apps/console/design/design-components.md). Solo binding y eventos;
 * toda escritura va por los comandos del store (drag/rotate/resize/delete).
 */
@Component({
  selector: 'mapit-element-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideRefreshCw],
  template: `
    <aside class="props-card" aria-label="{{ strings.properties }}">
      <header class="props-header">
        <span class="props-avatar" [attr.data-type]="element().type" aria-hidden="true">
          {{ element().type.slice(0, 1) }}
        </span>
        <span class="props-title">{{ element().label }}</span>
      </header>

      @if (store.canEditMetadata()) {
        <div class="props-section metadata-editor" data-testid="element-metadata">
          <h4>{{ strings.metadataTitle }}</h4>
          <label
            >{{ strings.metadataLabel }}
            <input
              data-testid="element-metadata-label"
              type="text"
              maxlength="120"
              [value]="metadataDraft().label"
              (input)="setLabel($event)"
            />
          </label>
          <label
            >{{ strings.metadataCapacity }}
            <input
              data-testid="element-metadata-capacity"
              type="number"
              min="1"
              step="1"
              [value]="metadataDraft().capacity"
              (input)="setCapacity($event)"
            />
          </label>
          @if (store.metadataError()) {
            <p role="alert" data-testid="element-metadata-error">{{ store.metadataError() }}</p>
          }
          <div class="metadata-actions">
            <button
              data-testid="element-metadata-clear"
              type="button"
              [disabled]="store.saving()"
              (click)="store.clearElementMetadata(element().id)"
            >
              {{ strings.metadataClear }}
            </button>
            <button
              data-testid="element-metadata-save"
              type="button"
              [disabled]="store.saving()"
              (click)="
                store.saveElementMetadata(
                  element().id,
                  metadataDraft().label,
                  metadataDraft().capacity
                )
              "
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
              [value]="currentX()"
              (change)="onUpdatePosition(valueAsNumber($event), currentY())"
            />
          </label>
          <label class="chip chip-y">
            <span>Y:</span>
            <input
              type="number"
              [value]="currentY()"
              (change)="onUpdatePosition(currentX(), valueAsNumber($event))"
            />
          </label>
        </div>
      </div>

      <div class="props-section">
        <h4>{{ strings.size }}</h4>
        <div class="chips">
          <label class="chip">
            <span>W:</span>
            <input
              type="number"
              min="20"
              [value]="roundedSize().width"
              (change)="onUpdateSize(valueAsNumber($event), roundedSize().height)"
            />
          </label>
          <label class="chip">
            <span>H:</span>
            <input
              type="number"
              min="20"
              [value]="roundedSize().height"
              (change)="onUpdateSize(roundedSize().width, valueAsNumber($event))"
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
              [value]="Math.round(element().rotation)"
              (change)="onUpdateRotation(valueAsNumber($event))"
            />
            <span>°</span>
          </label>
          <button
            class="btn-rotate"
            aria-label="{{ strings.rotation }}"
            (click)="onUpdateRotation(0)"
          >
            <svg lucideRefreshCw class="rotate-icon" aria-hidden="true"></svg>
          </button>
        </div>
      </div>

      <div class="props-section props-meta">
        <span class="state-badge" [attr.data-state]="element().state">{{ element().state }}</span>
        <span>{{ element().capacity ?? strings.capacityUnknown }}</span>
      </div>

      <button class="btn-delete" (click)="onDelete()">
        {{ floorStrings.deleteElement }}
      </button>
    </aside>
  `,
  styles: `
    :host {
      position: absolute;
      top: 16px;
      right: 16px;
      z-index: 5;
    }

    .props-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 250px;
      padding: 14px;
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border);
      border-radius: 12px;
      box-shadow: 0 4px 12px rgb(0 0 0 / 0.08);
    }

    .props-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .props-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--mapit-editor-selection-soft);
      color: var(--mapit-editor-selection);
      font: var(--mapit-text-body-bold);
    }

    .props-title {
      font: var(--mapit-text-body-bold);
      color: var(--mapit-editor-panel-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .props-section h4 {
      margin: 0 0 6px;
      font: var(--mapit-text-metadata);
      color: var(--mapit-editor-panel-muted);
    }

    .metadata-editor {
      display: grid;
      gap: 8px;
    }
    .metadata-editor label {
      display: grid;
      gap: 4px;
      font: var(--mapit-text-metadata);
      color: var(--mapit-editor-panel-muted);
    }
    .metadata-editor input {
      min-height: 40px;
      width: 100%;
      padding: 8px;
      border: 1px solid var(--mapit-color-border-input);
      border-radius: var(--mapit-radius-input);
      font: var(--mapit-text-body);
      color: var(--mapit-editor-panel-text);
    }
    .metadata-editor input:focus-visible {
      outline: 2px solid var(--mapit-editor-selection);
      outline-offset: 2px;
    }
    .metadata-editor p {
      margin: 0;
      color: var(--mapit-color-error);
    }
    .metadata-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .metadata-actions button {
      min-height: 40px;
      padding: 6px 8px;
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius-input);
      background: var(--mapit-color-surface);
      color: var(--mapit-color-primary);
      cursor: pointer;
    }
    .metadata-actions button:focus-visible {
      outline: 2px solid var(--mapit-color-primary);
      outline-offset: 2px;
    }

    .chips {
      display: flex;
      gap: 8px;
    }

    .chip {
      flex: 1;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: var(--mapit-editor-chip-bg);
      border: 1px solid var(--mapit-color-border);
      border-radius: 8px;
      font: var(--mapit-text-body-bold);
      color: var(--mapit-editor-panel-text);
    }

    .chip span {
      font-weight: 700;
    }

    .chip-x span {
      color: var(--mapit-editor-selection);
    }

    .chip-y span {
      color: var(--mapit-editor-selection-y-text);
    }

    .chip input {
      width: 100%;
      border: none;
      background: transparent;
      font: inherit;
      color: inherit;
      outline: none;
    }

    .chip:focus-within {
      border-color: var(--mapit-editor-selection);
      box-shadow: 0 0 0 2px rgb(37 99 235 / 0.2);
    }

    .btn-rotate {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: 1px solid var(--mapit-color-border);
      background: var(--mapit-color-surface);
      color: var(--mapit-editor-selection);
      font-size: 16px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background var(--mapit-duration-fast) var(--mapit-ease-out);
    }

    .btn-rotate:hover {
      background: var(--mapit-editor-selection-soft);
    }

    .btn-rotate:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgb(37 99 235 / 0.2);
    }

    .rotate-icon {
      width: 16px;
      height: 16px;
    }

    .props-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      border-top: 1px solid var(--mapit-color-border);
      padding-top: 10px;
      font: var(--mapit-text-metadata);
      color: var(--mapit-editor-panel-muted);
    }

    .btn-delete {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.75rem;
      border: 1px solid var(--mapit-color-error-border);
      border-radius: var(--mapit-radius-input);
      background: transparent;
      color: var(--mapit-color-error);
      font: inherit;
      font-size: 0.8125rem;
      cursor: pointer;
    }

    .btn-delete:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--mapit-color-focus-ring);
    }
  `,
})
export class ElementPropertiesCardComponent {
  readonly element = input.required<SpaceElement>();

  protected readonly store = inject(MapEditorStore);
  protected readonly strings = STRINGS.spaces.editor;
  protected readonly floorStrings = STRINGS.spaces.floorEditor;
  protected readonly Math = Math;
  protected readonly metadataDraft = linkedSignal(() => ({
    label: this.store.selectedMetadata()?.label ?? '',
    capacity: this.store.selectedMetadata()?.capacity?.toString() ?? '',
  }));

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

  protected readonly currentX = computed(() =>
    Math.round(this.store.selectedElementPosition()?.x ?? this.element().position.x),
  );
  protected readonly currentY = computed(() =>
    Math.round(this.store.selectedElementPosition()?.y ?? this.element().position.y),
  );
  protected readonly roundedSize = computed(() => ({
    width: Math.round(this.element().size.width),
    height: Math.round(this.element().size.height),
  }));

  protected valueAsNumber(event: Event): number {
    return (event.target as HTMLInputElement).valueAsNumber;
  }

  protected onUpdatePosition(x: number, y: number): void {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      this.store.dragElement(this.element().id, x, y);
    }
  }

  protected onUpdateSize(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    const el = this.element();
    this.store.resizeElement(el.id, el.position.x, el.position.y, width, height);
  }

  protected onUpdateRotation(rotation: number): void {
    if (Number.isFinite(rotation)) {
      this.store.rotateElement(this.element().id, rotation);
    }
  }

  /** Destructivo: pide confirmación (guía web). */
  protected onDelete(): void {
    const el = this.element();
    if (window.confirm(this.strings.deleteConfirm.replace('{label}', el.label))) {
      this.store.deleteElement(el.id);
    }
  }
}
