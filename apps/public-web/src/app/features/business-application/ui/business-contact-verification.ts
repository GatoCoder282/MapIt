import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { STRINGS } from '../../../core/strings';
import { BusinessApplicationApi } from '../data/business-application-api';

@Component({
  selector: 'mp-business-contact-verification',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="verification">
      <h1>{{ copy.verifyTitle }}</h1>
      <p role="status">{{ pending() ? copy.verifyPending : copy.verifyDone }}</p>
      <a routerLink="/negocios">{{ copy.back }}</a>
    </main>
  `,
  styles: [
    `
      .verification {
        max-width: 40rem;
        margin: 10vh auto;
        padding: 2rem;
        font: inherit;
      }
      a {
        color: #2635dd;
      }
    `,
  ],
})
export class BusinessContactVerification {
  protected readonly copy = STRINGS.businessApplication;
  protected readonly pending = signal(true);
  private readonly api = inject(BusinessApplicationApi);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const fragment = new URLSearchParams(globalThis.location.hash.slice(1));
    const token = fragment.get('token');
    globalThis.history.replaceState(null, '', globalThis.location.pathname);
    if (!token) {
      this.pending.set(false);
      return;
    }
    this.api
      .verify(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.pending.set(false),
        error: () => this.pending.set(false),
      });
  }
}
