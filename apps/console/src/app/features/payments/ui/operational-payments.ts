import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { STRINGS } from '../../../core/strings';
import { OperationalPaymentsStore } from '../model/operational-payments-store';

@Component({
  selector: 'mapit-operational-payments',
  providers: [OperationalPaymentsStore],
  template: ` <main class="operational-page">
    <h1>{{ strings.payments }}</h1>
    @if (store.status() === 'loading') {
      <p role="status">{{ strings.loading }}</p>
    }
    @if (store.status() === 'error') {
      <p role="alert">{{ strings.error }}</p>
      <button type="button" (click)="store.load()">{{ strings.retry }}</button>
    }
    @if (store.status() === 'ready' && store.page(); as page) {
      @if (!page.items.length) {
        <p>{{ strings.empty }}</p>
      } @else {
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{{ strings.reference }}</th>
                <th>{{ strings.date }}</th>
                <th>{{ strings.status }}</th>
                <th>{{ strings.amount }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (item of page.items; track item.id) {
                <tr>
                  <td>
                    <code>{{ item.reservationId }}</code>
                  </td>
                  <td>{{ item.createdAt }}</td>
                  <td>{{ item.status }}</td>
                  <td>{{ item.amount }} {{ item.currency }}</td>
                  <td>
                    @if (
                      item.provider === 'STATIC_BANK_QR' &&
                      item.status === 'PENDING_MANUAL_VERIFICATION'
                    ) {
                      <button
                        type="button"
                        [disabled]="store.verifying()"
                        (click)="store.select(item.id)"
                      >
                        {{ strings.verify }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (store.selectedPaymentId()) {
          <form (submit)="$event.preventDefault(); store.verify()">
            <label
              >{{ strings.bankReference }}
              <input
                type="text"
                maxlength="120"
                required
                [value]="store.bankReference()"
                [disabled]="store.verifying()"
                (input)="store.setBankReference($any($event.target).value)"
              />
            </label>
            <button type="submit" [disabled]="store.verifying() || !store.bankReference().trim()">
              {{ strings.verify }}
            </button>
            @if (store.verificationError()) {
              <p role="alert">{{ strings.verificationError }}</p>
            }
          </form>
        }
        <nav aria-label="Páginas">
          <button type="button" [disabled]="store.offset() === 0" (click)="store.move(-20)">
            {{ strings.previous }}
          </button>
          <button
            type="button"
            [disabled]="store.offset() + page.items.length >= page.total"
            (click)="store.move(20)"
          >
            {{ strings.next }}
          </button>
        </nav>
      }
    }
  </main>`,
  styles: [
    `
      .operational-page {
        padding: clamp(1rem, 3vw, 2rem);
        max-width: 80rem;
        margin: auto;
      }
      .table-scroll {
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        text-align: left;
        padding: 0.75rem;
        border-bottom: 1px solid #ddd;
      }
      nav {
        display: flex;
        gap: 0.75rem;
        margin-top: 1rem;
      }
      code {
        font-size: 0.8rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationalPayments {
  protected readonly strings = STRINGS.operational;
  protected readonly store = inject(OperationalPaymentsStore);
}
