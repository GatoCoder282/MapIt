import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { OnInit } from '@angular/core';
import type { Person, SpaceElement } from '@mapit/api-client';

import { STRINGS } from '../../../core/strings';
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
export class ReservationForm implements OnInit {
  protected readonly store = inject(ReservationFormStore);
  protected readonly strings = STRINGS.reservations.form;

  ngOnInit(): void {
    this.store.load();
  }

  protected onCustomerSelected(person: Person | null): void {
    this.store.setPerson(person);
  }

  protected elementTypeLabel(type: SpaceElement.TypeEnum): string {
    if (type === 'DECOR') return type;
    return this.strings.elementTypes[type];
  }
}
