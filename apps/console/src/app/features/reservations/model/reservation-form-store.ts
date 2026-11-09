import { computed, inject, Injectable, signal } from '@angular/core';
import type { Establishment, Person, Reservation, VerticalProfile } from '@mapit/api-client';
import { TYPE_DEFAULTS } from '@mapit/map-engine';
import { finalize } from 'rxjs';

import { STRINGS } from '../../../core/strings';
import { ReservationsApi, type ReservationElementOption } from '../data/reservations-api';

/**
 * ViewModel del formulario de creación de una reserva interna.
 *
 * HU-7.01/7.02: al elegir establecimiento carga su perfil de vertical. Con él decide qué
 * elementos ofrecer, si el intervalo son fechas y horas o días de estadía, y los textos.
 */
@Injectable()
export class ReservationFormStore {
  private readonly api = inject(ReservationsApi);

  private readonly establishmentsState = signal<Establishment[]>([]);
  private readonly establishmentIdState = signal('');
  private readonly selectedElementIdsState = signal<Set<string>>(new Set());
  private readonly personState = signal<Person | null>(null);
  private readonly startsAtState = signal('');
  private readonly endsAtState = signal('');
  private readonly loadingState = signal(false);
  private readonly submittingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly createdState = signal<Reservation | null>(null);
  private readonly profileState = signal<VerticalProfile | null>(null);
  private readonly allElementsState = signal<ReservationElementOption[]>([]);

  readonly establishments = this.establishmentsState.asReadonly();
  readonly establishmentId = this.establishmentIdState.asReadonly();
  /** Solo los tipos que la vertical reserva; sin perfil, el criterio previo del motor. */
  readonly elements = computed(() => {
    const reservable = this.profileState()?.reservableElementTypes as readonly string[] | undefined;
    return this.allElementsState().filter((element) =>
      reservable ? reservable.includes(element.type) : TYPE_DEFAULTS[element.type].reservable,
    );
  });
  readonly profile = this.profileState.asReadonly();
  /** La estadía de hotel se elige por días; las horas son las de check-in/out del perfil. */
  readonly stay = computed(() => this.profileState()?.bookingMode === 'STAY');
  readonly verticalDisabled = computed(() => this.profileState()?.enabled === false);
  readonly terms = computed(() => {
    const type = this.profileState()?.establishmentType ?? this.selectedEstablishment()?.type;
    return type ? STRINGS.reservations.form.verticals[type] : null;
  });
  /** Ayuda con los límites reales del perfil (horas máximas, check-in/out, noches). */
  readonly hint = computed(() => {
    const profile = this.profileState();
    const terms = this.terms();
    if (!profile || !terms) return '';
    return terms.hint
      .replace('{hours}', String((profile.maxDurationMinutes ?? 0) / 60))
      .replace('{start}', profile.defaultStartTime ?? '')
      .replace('{end}', profile.defaultEndTime ?? '')
      .replace('{min}', String(profile.minNights ?? ''))
      .replace('{max}', String(profile.maxNights ?? ''));
  });
  readonly selectedElementIds = this.selectedElementIdsState.asReadonly();
  readonly person = this.personState.asReadonly();
  readonly startsAt = this.startsAtState.asReadonly();
  readonly endsAt = this.endsAtState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly submitting = this.submittingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly created = this.createdState.asReadonly();
  readonly selectedEstablishment = computed(
    () =>
      this.establishmentsState().find(
        (establishment) => establishment.id === this.establishmentIdState(),
      ) ?? null,
  );
  readonly canSubmit = computed(
    () =>
      !this.submittingState() &&
      !this.verticalDisabled() &&
      this.personState() !== null &&
      Boolean(this.establishmentIdState()) &&
      Boolean(this.startsAtState()) &&
      Boolean(this.endsAtState()) &&
      this.selectedElementIdsState().size > 0,
  );

  load(): void {
    this.loadingState.set(true);
    this.errorState.set(null);
    this.api
      .listEstablishments()
      .pipe(finalize(() => this.loadingState.set(false)))
      .subscribe({
        next: (establishments) => {
          this.establishmentsState.set(establishments);
          if (establishments.length === 1) this.selectEstablishment(establishments[0]!.id);
        },
        error: () => this.errorState.set(STRINGS.reservations.form.errors.loadEstablishments),
      });
  }

  selectEstablishment(establishmentId: string): void {
    this.establishmentIdState.set(establishmentId);
    this.allElementsState.set([]);
    this.profileState.set(null);
    this.selectedElementIdsState.set(new Set());
    // Cambiar de vertical cambia el tipo de intervalo (fechas y horas ↔ días de estadía).
    this.startsAtState.set('');
    this.endsAtState.set('');
    this.errorState.set(null);
    if (!establishmentId) return;

    this.api.getVerticalProfile(establishmentId).subscribe({
      next: (profile) => {
        if (this.establishmentIdState() === establishmentId) this.profileState.set(profile);
      },
      // Sin perfil se reserva como antes; el backend sigue aplicando las reglas de la vertical.
      error: () => undefined,
    });
    this.loadingState.set(true);
    this.api
      .listReservableElements(establishmentId)
      .pipe(finalize(() => this.loadingState.set(false)))
      .subscribe({
        next: (elements) => this.allElementsState.set(elements),
        error: () => this.errorState.set(STRINGS.reservations.form.errors.loadElements),
      });
  }

  setPerson(person: Person | null): void {
    this.personState.set(person);
    this.errorState.set(null);
  }

  setStartsAt(value: string): void {
    this.startsAtState.set(value);
  }

  setEndsAt(value: string): void {
    this.endsAtState.set(value);
  }

  toggleElement(elementId: string, selected: boolean): void {
    this.selectedElementIdsState.update((current) => {
      const next = new Set(current);
      if (selected) next.add(elementId);
      else next.delete(elementId);
      return next;
    });
  }

  isElementSelected(elementId: string): boolean {
    return this.selectedElementIdsState().has(elementId);
  }

  submit(): void {
    const person = this.personState();
    const establishmentId = this.establishmentIdState();
    const timezone = this.selectedEstablishment()?.timezone;
    const startsAt = this.toInstant(this.withTime(this.startsAtState(), 'start'), timezone);
    const endsAt = this.toInstant(this.withTime(this.endsAtState(), 'end'), timezone);
    const elementIds = [...this.selectedElementIdsState()].filter((id) =>
      this.elements().some((element) => element.id === id),
    );

    if (!person) return this.fail(STRINGS.reservations.form.errors.customerRequired);
    if (!establishmentId) return this.fail(STRINGS.reservations.form.errors.establishmentRequired);
    if (!startsAt || !endsAt || startsAt >= endsAt)
      return this.fail(STRINGS.reservations.form.errors.invalidInterval);
    if (elementIds.length === 0)
      return this.fail(STRINGS.reservations.form.errors.elementsRequired);

    this.submittingState.set(true);
    this.errorState.set(null);
    this.api
      .createReservation(establishmentId, {
        personId: person.id,
        spaceElementIds: new Set(elementIds),
        startsAt,
        endsAt,
      })
      .pipe(finalize(() => this.submittingState.set(false)))
      .subscribe({
        next: (reservation) => this.createdState.set(reservation),
        error: (response: { status?: number }) => {
          const errors = STRINGS.reservations.form.errors;
          const message =
            response.status === 400
              ? errors.invalidRequest
              : response.status === 404
                ? errors.notFound
                : response.status === 409
                  ? errors.conflict
                  : response.status === 403
                    ? errors.verticalDisabled
                    : errors.create;
          this.errorState.set(message);
        },
      });
  }

  startAnother(): void {
    this.personState.set(null);
    this.startsAtState.set('');
    this.endsAtState.set('');
    this.selectedElementIdsState.set(new Set());
    this.createdState.set(null);
    this.errorState.set(null);
  }

  /** En estadía el formulario solo pide días; se completan con las horas del perfil. */
  private withTime(value: string, edge: 'start' | 'end'): string {
    const profile = this.profileState();
    if (!this.stay() || !profile || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const time = edge === 'start' ? profile.defaultStartTime : profile.defaultEndTime;
    return time ? `${value}T${time}` : value;
  }

  private fail(message: string): void {
    this.errorState.set(message);
  }

  private toInstant(value: string, timezone?: string): string | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match || !timezone) return null;

    const [, year, month, day, hour, minute] = match;
    const intendedWallTime = Date.UTC(+year!, +month! - 1, +day!, +hour!, +minute!);
    let candidate = intendedWallTime;

    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      });
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const parts = Object.fromEntries(
          formatter
            .formatToParts(new Date(candidate))
            .filter((part) => part.type !== 'literal')
            .map((part) => [part.type, Number(part.value)]),
        );
        const observedWallTime = Date.UTC(
          parts['year']!,
          parts['month']! - 1,
          parts['day'],
          parts['hour'],
          parts['minute'],
          parts['second'],
        );
        candidate += intendedWallTime - observedWallTime;
      }
      return new Date(candidate).toISOString();
    } catch {
      return null;
    }
  }
}
