import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { STRINGS } from '../../../core/strings';
import { OperationalReservationsStore } from '../model/operational-reservations-store';

@Component({
  selector: 'mapit-operational-reservations',
  providers: [OperationalReservationsStore],
  template: ` <main class="operational-page">
    <h1>{{ strings.reservations }}</h1>
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
                <th>{{ strings.spaces }}</th>
                <th>{{ strings.arrival }}</th>
              </tr>
            </thead>
            <tbody>
              @for (item of page.items; track item.id) {
                <tr>
                  <td>
                    <code>{{ item.id }}</code>
                  </td>
                  <td>{{ item.startsAt }}</td>
                  <td>{{ item.status }}</td>
                  <td>
                    @for (space of item.spaceElementIds; track space) {
                      <code>{{ space }}</code>
                    }
                  </td>
                  <td>{{ item.checkedIn ? strings.checkedIn : strings.pending }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
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
export class OperationalReservations {
  protected readonly strings = STRINGS.operational;
  protected readonly store = inject(OperationalReservationsStore);
}
