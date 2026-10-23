import { computed, inject, Injectable, signal } from '@angular/core';
import type { Person, PersonCreateRequest } from '@mapit/api-client';
import { finalize } from 'rxjs';

import { STRINGS } from '../../../core/strings';
import { ReservationsApi } from '../data/reservations-api';

export interface CustomerDraft {
  fullName: string;
  email: string;
  phone: string;
}

const EMPTY_DRAFT: CustomerDraft = { fullName: '', email: '', phone: '' };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** ViewModel del paso de búsqueda, selección y alta de cliente de una reserva. */
@Injectable()
export class ReservationCustomerStore {
  private readonly api = inject(ReservationsApi);

  private readonly queryState = signal('');
  private readonly resultsState = signal<Person[]>([]);
  private readonly selectedState = signal<Person | null>(null);
  private readonly draftState = signal<CustomerDraft>({ ...EMPTY_DRAFT });
  private readonly registrationOpenState = signal(false);
  private readonly searchingState = signal(false);
  private readonly savingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly query = this.queryState.asReadonly();
  readonly results = this.resultsState.asReadonly();
  readonly selected = this.selectedState.asReadonly();
  readonly draft = this.draftState.asReadonly();
  readonly registrationOpen = this.registrationOpenState.asReadonly();
  readonly searching = this.searchingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly hasSelection = computed(() => this.selectedState() !== null);

  setQuery(query: string): void {
    this.queryState.set(query);
  }

  search(): void {
    const query = this.queryState().trim();
    this.searchingState.set(true);
    this.errorState.set(null);
    this.api
      .searchPeople(query || undefined)
      .pipe(finalize(() => this.searchingState.set(false)))
      .subscribe({
        next: (people) => this.resultsState.set(people),
        error: () => {
          this.resultsState.set([]);
          this.errorState.set(STRINGS.reservations.customer.errors.search);
        },
      });
  }

  select(person: Person): void {
    this.selectedState.set(person);
    this.registrationOpenState.set(false);
    this.errorState.set(null);
  }

  clearSelection(): void {
    this.selectedState.set(null);
    this.errorState.set(null);
  }

  openRegistration(): void {
    this.draftState.set({ ...EMPTY_DRAFT, fullName: this.queryState().trim() });
    this.registrationOpenState.set(true);
    this.errorState.set(null);
  }

  cancelRegistration(): void {
    this.registrationOpenState.set(false);
    this.draftState.set({ ...EMPTY_DRAFT });
    this.errorState.set(null);
  }

  setFullName(fullName: string): void {
    this.draftState.update((draft) => ({ ...draft, fullName }));
  }

  setEmail(email: string): void {
    this.draftState.update((draft) => ({ ...draft, email }));
  }

  setPhone(phone: string): void {
    this.draftState.update((draft) => ({ ...draft, phone }));
  }

  register(): void {
    const draft = this.draftState();
    const fullName = draft.fullName.trim();
    const email = draft.email.trim().toLowerCase();
    const phone = draft.phone.trim();
    if (!fullName) {
      this.errorState.set(STRINGS.reservations.customer.errors.fullNameRequired);
      return;
    }
    if (email && !EMAIL_PATTERN.test(email)) {
      this.errorState.set(STRINGS.reservations.customer.errors.emailInvalid);
      return;
    }

    const request: PersonCreateRequest = {
      fullName,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    };
    this.savingState.set(true);
    this.errorState.set(null);
    this.api
      .createPerson(request)
      .pipe(finalize(() => this.savingState.set(false)))
      .subscribe({
        next: (person) => {
          this.resultsState.update((people) => [
            person,
            ...people.filter((candidate) => candidate.id !== person.id),
          ]);
          this.selectedState.set(person);
          this.registrationOpenState.set(false);
          this.draftState.set({ ...EMPTY_DRAFT });
        },
        error: (response: { status?: number }) =>
          this.errorState.set(
            response.status === 409
              ? STRINGS.reservations.customer.errors.emailConflict
              : STRINGS.reservations.customer.errors.create,
          ),
      });
  }
}
