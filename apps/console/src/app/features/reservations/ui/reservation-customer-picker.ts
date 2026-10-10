import { ChangeDetectionStrategy, Component, effect, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Person } from '@mapit/api-client';

import { STRINGS } from '../../../core/strings';
import { ReservationCustomerStore } from '../model/reservation-customer-store';

/** Paso reutilizable de búsqueda, selección y alta de cliente de la reserva interna. */
@Component({
  selector: 'mapit-reservation-customer-picker',
  imports: [FormsModule],
  providers: [ReservationCustomerStore],
  templateUrl: './reservation-customer-picker.html',
  styleUrl: './reservation-customer-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationCustomerPicker {
  protected readonly store = inject(ReservationCustomerStore);
  protected readonly strings = STRINGS.reservations.customer;
  readonly personSelected = output<Person | null>();

  private readonly notifySelection = effect(() => {
    this.personSelected.emit(this.store.selected());
  });
}
