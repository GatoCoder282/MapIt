import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { STRINGS } from '../../../core/strings';
import { NotificationPreferencesStore } from '../model/notification-preferences-store';

@Component({
  selector: 'mapit-notification-preferences',
  providers: [NotificationPreferencesStore],
  template: `<details (toggle)="opened($event)">
    <summary>{{ strings.preferences }}</summary>
    <p>{{ strings.preferencesHint }}</p>
    @if (vm.busy()) {
      <p role="status">{{ strings.preferencesLoading }}</p>
    }
    @if (vm.preferences(); as preferences) {
      <fieldset [disabled]="vm.busy()">
        <legend>{{ strings.preferences }}</legend>
        <label
          ><input
            type="checkbox"
            [checked]="preferences.reservations"
            (change)="edited('reservations', $event)"
          />{{ strings.preferencesReservations }}</label
        >
        <label
          ><input
            type="checkbox"
            [checked]="preferences.operations"
            (change)="edited('operations', $event)"
          />{{ strings.preferencesOperations }}</label
        >
        <button type="button" (click)="vm.save()" [disabled]="!vm.changed()">
          {{ strings.savePreferences }}
        </button>
      </fieldset>
    }
    @if (vm.error()) {
      <p role="alert">{{ strings.preferencesError }}</p>
      <button type="button" (click)="vm.preferences() ? vm.save() : vm.load()">
        {{ strings.retry }}
      </button>
    }
    @if (vm.saved()) {
      <p role="status">{{ strings.preferencesSaved }}</p>
    }
  </details>`,
  styles: `
    :host {
      display: block;
      padding: 0.75rem 1rem;
      border-top: 1px solid var(--mapit-color-border);
    }
    summary,
    button,
    input {
      cursor: pointer;
    }
    summary:focus-visible,
    input:focus-visible,
    button:focus-visible {
      outline: 2px solid var(--mapit-color-primary);
      outline-offset: 3px;
    }
    fieldset {
      border: 0;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 0.5rem;
    }
    legend {
      position: absolute;
      clip-path: inset(50%);
      width: 1px;
      height: 1px;
      overflow: hidden;
    }
    label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 2.75rem;
    }
    input {
      accent-color: var(--mapit-color-primary);
      width: 1.25rem;
      height: 1.25rem;
    }
    button {
      font: inherit;
      color: var(--mapit-color-primary);
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border-input);
      border-radius: 0.5rem;
      padding: 0.5rem 0.75rem;
      min-height: 2.75rem;
    }
    button:disabled {
      color: var(--mapit-color-text-muted);
      cursor: default;
    }
    p {
      font: var(--mapit-text-metadata);
      line-height: 1.5;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPreferencesComponent {
  protected readonly vm = inject(NotificationPreferencesStore);
  protected readonly strings = STRINGS.notifications;
  protected opened(event: Event): void {
    if ((event.target as HTMLDetailsElement).open) this.vm.load();
  }
  protected edited(key: 'reservations' | 'operations', event: Event): void {
    this.vm.edit(key, (event.target as HTMLInputElement).checked);
  }
}
