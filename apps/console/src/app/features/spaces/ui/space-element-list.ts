import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import type { SpaceElement, SpaceElementOperationalState } from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { SpacesStore } from '../model/spaces-store';
import { canChangeSpaceElementState } from '../model/space-element-state-options';
import { SpaceElementFormComponent } from './space-element-form';
import { SpaceElementStateActionComponent } from './space-element-state-action';

/**
 * Lista y registro de elementos espaciales dentro de un sector (HU-2.03 / MAP-117-118).
 * Sin drag&drop (eso pertenece a HU-4.01). Sigue el patrón de `sector-list`.
 */
@Component({
  selector: 'mapit-space-element-list',
  imports: [SpaceElementFormComponent, SpaceElementStateActionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="elements-container">
      <div class="elements-header">
        <div class="header-copy">
          <p class="elements-title">{{ strings.title }}</p>
          <p class="elements-subtitle">{{ strings.subtitle }}</p>
        </div>
        <button class="btn-primary" type="button" (click)="startCreate()">
          {{ strings.createButton }}
        </button>
      </div>

      @if (store.error(); as error) {
        <p class="message error" role="alert">{{ error }}</p>
      }

      @if (loading()) {
        <div class="state">{{ strings.loading }}</div>
      } @else if (elements().length === 0) {
        <div class="state empty">{{ strings.empty }}</div>
      }

      @if (elements().length > 0) {
        <table class="elements-table">
          <thead>
            <tr>
              <th>{{ strings.list.typeHeader }}</th>
              <th>{{ strings.list.coordHeader }}</th>
              <th>{{ strings.list.stateHeader }}</th>
              <th>{{ strings.list.actionsHeader }}</th>
            </tr>
          </thead>
          <tbody>
            @for (element of elements(); track element.id) {
              <tr>
                <td>{{ typeLabel(element.type) }}</td>
                <td>({{ element.x }}, {{ element.y }})</td>
                <td>{{ stateLabel(element.state) }}</td>
                <td>
                  <div class="element-actions">
                    <button
                      class="btn-secondary"
                      type="button"
                      [disabled]="store.saving()"
                      (click)="startEdit(element)"
                    >
                      {{ strings.list.editButton }}
                    </button>
                    @if (canChangeState()) {
                      <mapit-space-element-state-action
                        [elementId]="element.id"
                        [currentState]="element.state"
                        [busy]="store.elementStateSaving(element.id)"
                        [feedback]="store.elementStateFeedback(element.id)"
                        (stateChangeRequested)="changeState(element.id, $event)"
                      />
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }

      @if (showForm()) {
        <mapit-space-element-form
          [sectorId]="sectorId()"
          (saved)="onSaved()"
          (formClosed)="onClosed()"
        />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .elements-container {
      margin-top: 1rem;
    }

    .elements-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }

    .header-copy {
      flex: 1;
    }

    .elements-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: var(--mapit-color-text);
    }

    .elements-subtitle {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--mapit-color-text-muted);
    }

    .state {
      padding: 1.5rem;
      text-align: center;
      font-size: 0.875rem;
      color: var(--mapit-color-text-muted);
    }

    .empty {
      border: 1px dashed var(--mapit-color-border);
      border-radius: var(--mapit-radius);
    }

    .message {
      margin: 0 0 0.75rem;
      padding: 0.5rem 0.75rem;
      border-radius: var(--mapit-radius-input);
      font-size: 0.8125rem;
    }
    .error {
      color: var(--mapit-color-error);
      background: #fef2f2;
    }

    .elements-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius);
      overflow: hidden;
    }

    .elements-table th,
    .elements-table td {
      padding: 0.625rem 0.75rem;
      text-align: left;
      font-size: 0.8rem;
    }

    .elements-table th {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--mapit-color-text-muted);
      background: var(--mapit-color-surface-low);
      border-bottom: 1px solid var(--mapit-color-border);
    }

    .elements-table td {
      color: var(--mapit-color-text);
      vertical-align: middle;
    }
    .elements-table tbody tr {
      border-top: 1px solid var(--mapit-color-border);
    }

    .element-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1rem;
      border-radius: var(--mapit-radius-input);
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-primary {
      border: none;
      background: var(--mapit-color-primary);
      color: var(--mapit-color-on-primary);
    }
    .btn-primary:hover:not(:disabled) {
      background: #1628b8;
    }
    .btn-secondary {
      border: 1px solid var(--mapit-color-border);
      background: var(--mapit-color-surface);
      color: var(--mapit-color-text);
    }
    .btn-secondary:hover:not(:disabled) {
      background: var(--mapit-color-surface-low);
    }
    .btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `,
})
export class SpaceElementListComponent {
  readonly sectorId = input.required<string>();

  protected readonly store = inject(SpacesStore);
  private readonly session = inject(AuthSession);
  protected readonly strings = this.store.strings_.elements;

  protected readonly showForm = signal(false);

  protected readonly elements = computed(
    () => this.store.elementsBySector()[this.sectorId()] ?? [],
  );
  protected readonly loading = computed(() => this.store.elementsLoading(this.sectorId()));
  protected readonly canChangeState = computed(() =>
    canChangeSpaceElementState(this.session.user()?.role),
  );

  constructor() {
    effect(() => {
      // Re-cargar cuando cambia el sector del input.
      const id = this.sectorId();
      if (id) this.store.loadSpaceElementsBySector(id);
    });
  }

  protected startCreate(): void {
    this.store.startNewElement();
    this.showForm.set(true);
  }

  protected startEdit(element: SpaceElement): void {
    this.store.editElement(element);
    this.showForm.set(true);
  }

  protected changeState(elementId: string, state: SpaceElementOperationalState): void {
    this.store.changeElementState(this.sectorId(), elementId, state);
  }

  protected onSaved(): void {
    this.showForm.set(false);
    void this.store.loadSpaceElementsBySector(this.sectorId());
  }

  protected onClosed(): void {
    this.showForm.set(false);
    this.store.startNewElement();
  }

  protected typeLabel(type: string): string {
    return this.strings.types[type as keyof typeof this.strings.types] ?? type;
  }

  protected stateLabel(state: string): string {
    return this.strings.states[state as keyof typeof this.strings.states] ?? state;
  }
}
