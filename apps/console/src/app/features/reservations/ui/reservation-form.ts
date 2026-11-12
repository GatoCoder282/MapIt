import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { Person, SpaceElement } from '@mapit/api-client';

import { localizeString, STRINGS } from '../../../core/strings';
import { confirmOperationalExit } from '../../../core/operational-exit-guard';
import { EstablishmentContext } from '../../../core/establishment-context';
import { ReservationFormStore } from '../model/reservation-form-store';
import { ReservationCustomerPicker } from './reservation-customer-picker';

/** Pantalla de creación de reservas internas para el personal del tenant. */
@Component({
  selector: 'mapit-reservation-form',
  imports: [ReservationCustomerPicker],
  providers: [ReservationFormStore],
  templateUrl: './reservation-form.html',
  styleUrl: './reservation-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationForm {
  protected readonly localizeString = localizeString;
  protected readonly store = inject(ReservationFormStore);
  protected readonly strings = STRINGS.reservations.form;
  protected readonly establishmentContext = inject(EstablishmentContext);

  canDeactivate(): boolean {
    return confirmOperationalExit(this.store.busy(), this.store.dirty());
  }

  protected onCustomerSelected(person: Person | null): void {
    this.store.setPerson(person);
  }

  protected elementTypeLabel(type: SpaceElement.TypeEnum): string {
    if (type === 'DECOR') return type;
    return this.strings.elementTypes[type];
  }
}
