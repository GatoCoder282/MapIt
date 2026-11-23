import { HttpErrorResponse } from '@angular/common/http';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PeopleService, ReservationsService } from '@mapit/api-client';
import { finalize, of, switchMap, throwError } from 'rxjs';
import { establishmentInstant, establishmentWallTime } from '../../../core/establishment-time';
import {
  availableQuickElements,
  OperationalMapData,
  QUICK_RESERVATION_MINUTES,
} from '../../../core/operational-map-data';
import { STRINGS } from '../../../core/strings';
import { SpaceMonitorStore } from './space-monitor-store';

export interface QuickReservationDraft {
  name: string;
  country: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  people: number;
  notes: string;
}

interface QuickBooking {
  establishmentId: string;
  elementId: string;
  startsAt: string;
  endsAt: string;
  partySize: number;
}

const NANP_PHONE = /^[2-9]\d{2}[2-9]\d{6}$/;
const PHONE_COUNTRIES = [
  { code: 'BO', prefix: '+591', pattern: /^[67]\d{7}$/ },
  { code: 'US', prefix: '+1', pattern: NANP_PHONE },
  { code: 'CA', prefix: '+1', pattern: NANP_PHONE },
  { code: 'ES', prefix: '+34', pattern: /^[67]\d{8}$/ },
];

function phoneDigits(value: string): string {
  return value.replace(/[\s().-]/g, '');
}

@Injectable()
export class QuickReservationStore {
  private readonly monitor = inject(SpaceMonitorStore);
  private readonly data = inject(OperationalMapData);
  private readonly customers = inject(PeopleService);
  private readonly bookings = inject(ReservationsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly strings = STRINGS.spaces.editor.monitor.quickBooking;
  private readonly selection = computed(() => {
    const establishment = this.monitor.establishment();
    const element = this.monitor.selected();
    return establishment && element?.type === 'TABLE' && element.reservable
      ? `${establishment.id}:${element.id}`
      : null;
  });
  readonly scope = computed(() => {
    const element = this.monitor.selected();
    if (!this.selection() || !element) return null;
    const floor = this.monitor.floors().find(({ id }) => id === this.monitor.floorId());
    const sector = this.monitor.sector();
    return {
      id: element.id,
      label: element.label,
      location: [...new Set([floor?.name, sector?.name].filter(Boolean))].join(' · '),
      capacity: element.capacity ?? 0,
    };
  });
  readonly capacity = computed(() => this.scope()?.capacity ?? 0);
  readonly today = computed(() => {
    const timezone = this.monitor.establishment()?.timezone;
    return timezone
      ? (establishmentWallTime(new Date(this.data.now()).toISOString(), timezone)?.slice(0, 10) ??
          '')
      : '';
  });
  private readonly fields = linkedSignal({
    source: this.selection,
    computation: () => this.initialDraft(),
  });
  readonly draft = this.fields.asReadonly();
  readonly dirty = linkedSignal({ source: this.selection, computation: () => false });
  readonly phoneCountries = PHONE_COUNTRIES;
  readonly phoneCountry = computed(() =>
    this.phoneCountries.find(({ code }) => code === this.fields().country),
  );
  private readonly booking = computed<QuickBooking | null>(
    () => {
      const scope = this.scope();
      const establishment = this.monitor.establishment();
      const { date, time, people } = this.fields();
      if (
        !scope ||
        !establishment ||
        !Number.isSafeInteger(people) ||
        people < 1 ||
        people > scope.capacity
      )
        return null;
      const startsAt = establishmentInstant(`${date}T${time}`, establishment.timezone);
      if (!startsAt) return null;
      return {
        establishmentId: establishment.id,
        elementId: scope.id,
        startsAt,
        endsAt: new Date(Date.parse(startsAt) + QUICK_RESERVATION_MINUTES * 60_000).toISOString(),
        partySize: people,
      };
    },
    {
      equal: (a, b) =>
        a?.establishmentId === b?.establishmentId &&
        a?.elementId === b?.elementId &&
        a?.startsAt === b?.startsAt &&
        a?.partySize === b?.partySize,
    },
  );
  private readonly checked = signal<{
    booking: QuickBooking;
    previous: ReturnType<OperationalMapData['snapshot']>;
  } | null>(null);
  private readonly conflict = linkedSignal({
    source: this.booking,
    computation: () => false,
  });
  readonly availability = computed(() => {
    const booking = this.booking();
    if (!booking) return 'idle';
    if (Date.parse(booking.startsAt) <= this.data.now() || this.conflict()) return 'unavailable';
    const checked = this.checked();
    if (checked?.booking !== booking || checked.previous === this.data.snapshot())
      return 'checking';
    if (this.data.status() !== 'ready') return 'error';
    const available = availableQuickElements(
      this.data.elements().filter(({ element }) => element.id === booking.elementId),
      this.data.reservations(),
      booking.startsAt,
      booking.endsAt,
      booking.partySize,
      this.data.now(),
    );
    return available.length ? 'available' : 'unavailable';
  });
  readonly busy = signal(false);
  private readonly outcome = linkedSignal({
    source: this.selection,
    computation: (): 'success' | 'conflict' | 'contactError' | 'saveError' | null => null,
  });
  readonly succeeded = computed(() => this.outcome() === 'success');
  readonly message = computed(() => {
    const outcome = this.outcome();
    return outcome ? this.strings[outcome] : null;
  });
  readonly phoneInvalid = computed(() => {
    const { phone } = this.fields();
    return !!phone.trim() && !this.phoneCountry()?.pattern.test(phoneDigits(phone));
  });
  private readonly contact = computed(() => {
    const { name, phone, email } = this.fields();
    const country = this.phoneCountry();
    const fullName = name.trim();
    const number = phoneDigits(phone);
    const emailAddress = email.trim();
    if (
      !fullName ||
      !country ||
      fullName.length > 120 ||
      !number ||
      this.phoneInvalid() ||
      (emailAddress &&
        (emailAddress.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailAddress)))
    )
      return null;
    return {
      fullName,
      phone: country.prefix + number,
      ...(emailAddress ? { email: emailAddress } : {}),
    };
  });
  readonly canSubmit = computed(
    () =>
      !this.busy() &&
      this.availability() === 'available' &&
      !!this.contact() &&
      this.fields().notes.length <= 1000,
  );

  constructor() {
    effect(() => {
      const booking = this.booking();
      untracked(() => this.checkAvailability(booking));
    });
  }

  update<K extends keyof QuickReservationDraft>(key: K, value: QuickReservationDraft[K]): void {
    if (this.busy()) return;
    this.fields.update((draft) => ({ ...draft, [key]: value }));
    this.dirty.set(true);
    this.outcome.set(null);
  }

  prefill(startsAt: string, people: number): void {
    const establishment = this.monitor.establishment();
    if (!establishment || this.busy() || this.dirty()) return;
    const local = establishmentWallTime(startsAt, establishment.timezone);
    if (!local || !Number.isSafeInteger(people) || people < 1 || people > this.capacity()) return;
    this.fields.update((draft) => ({
      ...draft,
      date: local.slice(0, 10),
      time: local.slice(11),
      people,
    }));
  }

  reset(): void {
    if (this.busy()) return;
    this.fields.set(this.initialDraft());
    this.dirty.set(false);
    this.outcome.set(null);
  }

  retryAvailability(): void {
    this.checkAvailability(this.booking());
  }

  private checkAvailability(booking: QuickBooking | null): void {
    if (!booking || Date.parse(booking.startsAt) <= this.data.now()) {
      this.checked.set(null);
      return;
    }
    this.checked.set({ booking, previous: this.data.snapshot() });
    this.data.refresh();
  }

  submit(): void {
    const booking = this.booking();
    const contact = this.contact();
    if (!this.canSubmit() || !booking || !contact) return;
    const selection = this.selection();
    const notes = this.fields().notes.trim();
    this.busy.set(true);
    this.outcome.set(null);
    let resolvedContact = false;
    this.customers
      .searchPeople({ query: contact.fullName })
      .pipe(
        switchMap((people) => {
          if (this.selection() !== selection) return of(null);
          const matches = people.filter(
            (person) =>
              phoneDigits(person.phone ?? '') === contact.phone &&
              person.fullName.trim().toLowerCase() === contact.fullName.toLowerCase(),
          );
          if (matches.length > 1) return throwError(() => new Error('Ambiguous contact'));
          return matches[0]
            ? of(matches[0])
            : this.customers.createPerson({ personCreateRequest: contact });
        }),
        switchMap((person) => {
          if (!person || this.selection() !== selection) return of(null);
          resolvedContact = true;
          return this.bookings.createReservation({
            establishmentId: booking.establishmentId,
            reservationCreateRequest: {
              personId: person.id,
              startsAt: booking.startsAt,
              endsAt: booking.endsAt,
              partySize: booking.partySize,
              // The generated client represents uniqueItems as a Set. JSON needs an array.
              spaceElementIds: [booking.elementId] as unknown as Set<string>,
              ...(notes ? { notes } : {}),
            },
          });
        }),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (reservation) => {
          if (!reservation) return;
          this.data.refresh();
          if (this.selection() !== selection) return;
          this.fields.set(this.initialDraft());
          this.dirty.set(false);
          this.outcome.set('success');
        },
        error: (error: unknown) => {
          if (this.selection() !== selection) return;
          if (resolvedContact && error instanceof HttpErrorResponse && error.status === 409) {
            this.conflict.set(true);
            this.outcome.set('conflict');
            this.data.refresh();
          } else {
            this.outcome.set(resolvedContact ? 'saveError' : 'contactError');
          }
        },
      });
  }

  private initialDraft(): QuickReservationDraft {
    return {
      name: '',
      country: 'BO',
      phone: '',
      email: '',
      date: '',
      time: '',
      people: Math.min(this.capacity() || 1, 2),
      notes: '',
    };
  }
}
