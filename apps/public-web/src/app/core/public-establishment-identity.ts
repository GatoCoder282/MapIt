import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { PublicAvailabilityService, type PublicEstablishmentSummary } from '@mapit/api-client';
import { STRINGS } from './strings';

/** Datos públicos actuales, siempre resueltos por ambos slugs en el backend. */
@Component({
  selector: 'mp-public-establishment-identity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="identity" aria-live="polite" data-testid="public-establishment-identity">
      @if (venue(); as item) {
        <p>
          {{ strings.company }}: <strong>{{ item.tenantName }}</strong>
        </p>
        <p>
          {{ strings.local }}: <strong>{{ item.name }}</strong>
        </p>
        <p>{{ item.address || strings.missingAddress }}</p>
        <small
          >{{ strings.code }}: {{ item.establishmentSlug }} · {{ strings.timezone }}:
          {{ item.timezone }}</small
        >
      } @else if (error()) {
        <p role="status">{{ strings.error }}</p>
        <button type="button" (click)="reload()">{{ strings.retry }}</button>
      } @else {
        <p role="status">{{ strings.loading }}</p>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      margin-block: 1rem;
    }
    .identity {
      padding: 1rem;
      border: 1px solid var(--mapit-color-border);
      border-radius: 8px;
      overflow-wrap: anywhere;
    }
    .identity p {
      margin: 0 0 0.5rem;
    }
    .identity small {
      color: var(--mapit-color-text-muted);
    }
    button {
      font: inherit;
      color: var(--mapit-color-primary);
      cursor: pointer;
    }
    button:focus-visible {
      outline: 2px solid var(--mapit-color-primary);
      outline-offset: 3px;
    }
  `,
})
export class PublicEstablishmentIdentity {
  readonly tenantSlug = input.required<string>();
  readonly establishmentSlug = input.required<string>();
  private readonly client = inject(PublicAvailabilityService);
  private readonly revision = signal(0);
  protected readonly venue = signal<PublicEstablishmentSummary | null>(null);
  protected readonly error = signal(false);
  protected readonly strings = STRINGS.venueIdentity;
  constructor() {
    effect((onCleanup) => {
      const tenantSlug = this.tenantSlug();
      const establishmentSlug = this.establishmentSlug();
      this.revision();
      this.venue.set(null);
      this.error.set(false);
      const request = this.client
        .getPublicEstablishment({ tenantSlug, establishmentSlug })
        .subscribe({ next: (item) => this.venue.set(item), error: () => this.error.set(true) });
      onCleanup(() => request.unsubscribe());
    });
  }
  protected reload(): void {
    this.revision.update((value) => value + 1);
  }
}
