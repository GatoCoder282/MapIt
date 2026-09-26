import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import type { SpaceElementOperationalState } from '@mapit/api-client';

import { STRINGS } from '../../../core/strings';
import { availableStateTransitions } from '../model/space-element-state-options';
import type { SpaceElementStateFeedback } from '../model/spaces-store';

/** Acción visual de MAP-127. La persistencia del evento corresponde a MAP-128. */
@Component({
  selector: 'mapit-space-element-state-action',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (expanded()) {
      <div class="state-action" role="group" [attr.aria-label]="strings.groupAriaLabel">
        <label class="state-label" [for]="selectId()">{{ strings.label }}</label>
        <select
          class="state-select"
          [id]="selectId()"
          [value]="selectedState()"
          [disabled]="busy()"
          [attr.aria-label]="strings.selectAriaLabel"
          (change)="selectState($event)"
        >
          @for (state of options(); track state) {
            <option [value]="state">{{ stateLabel(state) }}</option>
          }
        </select>
        <div class="state-buttons">
          <button class="confirm-button" type="button" [disabled]="busy()" (click)="confirm()">
            {{ busy() ? strings.updating : strings.confirmButton }}
          </button>
          <button class="cancel-button" type="button" [disabled]="busy()" (click)="cancel()">
            {{ strings.cancelButton }}
          </button>
        </div>
      </div>
    } @else {
      <button
        class="change-button"
        type="button"
        [attr.aria-label]="strings.changeAriaLabel"
        (click)="open()"
      >
        {{ strings.changeButton }}
      </button>
    }
    @if (feedback(); as result) {
      <p
        class="feedback"
        [class.feedback-success]="result.kind === 'success'"
        [class.feedback-error]="result.kind === 'error'"
        [attr.role]="result.kind === 'error' ? 'alert' : 'status'"
      >
        {{ result.message }}
      </p>
    }
  `,
  styles: `
    :host {
      display: inline-block;
    }

    .state-action {
      display: grid;
      grid-template-columns: minmax(8rem, 1fr) auto;
      align-items: end;
      gap: 0.35rem 0.5rem;
      min-width: 15rem;
    }

    .state-label {
      grid-column: 1 / -1;
      font-size: 0.6875rem;
      font-weight: 700;
      color: var(--mapit-color-text-muted);
    }

    .state-select,
    button {
      min-height: 2.25rem;
      border-radius: var(--mapit-radius-input);
      font: inherit;
      font-size: 0.75rem;
    }

    .state-select {
      padding: 0.35rem 1.75rem 0.35rem 0.5rem;
      border: 1px solid var(--mapit-color-border-input);
      background: var(--mapit-color-surface);
      color: var(--mapit-color-text);
    }

    .state-buttons {
      display: flex;
      gap: 0.25rem;
    }

    button {
      padding: 0.4rem 0.65rem;
      border: 1px solid var(--mapit-color-border);
      cursor: pointer;
      font-weight: 600;
    }

    .change-button,
    .cancel-button {
      background: var(--mapit-color-surface);
      color: var(--mapit-color-text);
    }

    .change-button:hover,
    .cancel-button:hover {
      background: var(--mapit-color-surface-low);
    }

    .confirm-button {
      border-color: var(--mapit-color-primary);
      background: var(--mapit-color-primary);
      color: var(--mapit-color-on-primary);
    }

    .state-select:focus-visible,
    button:focus-visible {
      outline: 3px solid var(--mapit-color-focus-ring);
      outline-offset: 2px;
    }

    button:disabled,
    .state-select:disabled {
      cursor: wait;
      opacity: 0.65;
    }

    .feedback {
      margin: 0.35rem 0 0;
      max-width: 18rem;
      font-size: 0.6875rem;
      line-height: 1.35;
    }

    .feedback-success {
      color: #15803d;
    }

    .feedback-error {
      color: var(--mapit-color-error);
    }
  `,
})
export class SpaceElementStateActionComponent {
  readonly elementId = input.required<string>();
  readonly currentState = input.required<SpaceElementOperationalState>();
  readonly busy = input(false);
  readonly feedback = input<SpaceElementStateFeedback>();
  readonly stateChangeRequested = output<SpaceElementOperationalState>();

  protected readonly strings = STRINGS.spaces.elements.stateAction;
  protected readonly expanded = signal(false);
  protected readonly options = computed(() => availableStateTransitions(this.currentState()));
  protected readonly selectedState = signal<SpaceElementOperationalState>('AVAILABLE');
  protected readonly selectId = computed(() => `state-${this.elementId()}`);
  private previousState: SpaceElementOperationalState | undefined;

  constructor() {
    effect(() => {
      const current = this.currentState();
      const firstOption = this.options()[0];
      if (firstOption) this.selectedState.set(firstOption);
      if (this.previousState !== undefined && this.previousState !== current) {
        this.expanded.set(false);
      }
      this.previousState = current;
    });
  }

  protected open(): void {
    this.expanded.set(true);
  }

  protected cancel(): void {
    this.expanded.set(false);
  }

  protected selectState(event: Event): void {
    this.selectedState.set(
      (event.target as HTMLSelectElement).value as SpaceElementOperationalState,
    );
  }

  protected confirm(): void {
    this.stateChangeRequested.emit(this.selectedState());
  }

  protected stateLabel(state: SpaceElementOperationalState): string {
    return STRINGS.spaces.elements.states[state];
  }
}
