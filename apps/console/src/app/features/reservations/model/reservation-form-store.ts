import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
  type Signal,
} from '@angular/core';
import type { Person, Reservation } from '@mapit/api-client';
import { finalize, type Subscription } from 'rxjs';

import { EstablishmentContext } from '../../../core/establishment-context';
import { STRINGS } from '../../../core/strings';
import { ReservationsApi, type ReservationElementOption } from '../data/reservations-api';

/** ViewModel del formulario de creación de una reserva interna. */
@Injectable()
export class ReservationFormStore {
  private readonly api = inject(ReservationsApi);
  private readonly context = inject(EstablishmentContext);
  private generation = 0;
  private loadedEstablishmentId: string | null = null;
  private elementsRequest: Subscription | null = null;
  private writeRequest: Subscription | null = null;
  private readonly elementsState = signal<ReservationElementOption[]>([]);
  private readonly selectedElementIdsState = signal<Set<string>>(new Set());
  private readonly personState = signal<Person | null>(null);
  private readonly startsAtState = signal('');
  private readonly endsAtState = signal('');
  private readonly loadingState = signal(false);
  private readonly submittingState = signal(false);
  private readonly writesInFlight = signal(0);
  private readonly errorState = signal<string | null>(null);
  private readonly createdState = signal<Reservation | null>(null);

  readonly establishmentId = computed(() => this.context.active()?.id ?? '');
  readonly establishmentName = computed(() => this.context.active()?.name ?? '');
  readonly elements = this.elementsState.asReadonly();
  readonly selectedElementIds = this.selectedElementIdsState.asReadonly();
  readonly person = this.personState.asReadonly();
  readonly startsAt = this.startsAtState.asReadonly();
  readonly endsAt = this.endsAtState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly submitting = this.submittingState.asReadonly();
  readonly busy: Signal<boolean> = computed(() => this.writesInFlight() > 0);
  readonly dirty = computed(
    () =>
      this.createdState() === null &&
      (this.personState() !== null ||
        !!this.startsAtState() ||
        !!this.endsAtState() ||
        this.selectedElementIdsState().size > 0),
  );
  readonly error = this.errorState.asReadonly();
  readonly created = this.createdState.asReadonly();
  readonly canSubmit = computed(
    () =>
      this.context.status() === 'ready' &&
      this.context.active() !== null &&
      this.loadedEstablishmentId === this.context.active()?.id &&
      !this.submittingState() &&
      this.personState() !== null &&
      Boolean(this.startsAtState()) &&
      Boolean(this.endsAtState()) &&
      this.selectedElementIdsState().size > 0,
  );

  constructor() {
    effect((onCleanup) => {
      const status = this.context.status();
      const establishment = this.context.active();
      const id = status === 'ready' ? (establishment?.id ?? null) : null;
      const generation = ++this.generation;
      this.resetForContext();
      this.loadedEstablishmentId = id;
      if (id) this.loadElements(id, generation);
      onCleanup(() => this.elementsRequest?.unsubscribe());
    });
    inject(DestroyRef).onDestroy(() => {
      this.generation++;
      this.elementsRequest?.unsubscribe();
      this.writeRequest?.unsubscribe();
    });
  }

  /** Reintenta la carga de elementos del establecimiento activo. */
  load(): void {
    const id = this.currentEstablishmentId();
    if (!id) return;
    const generation = ++this.generation;
    this.elementsRequest?.unsubscribe();
    this.elementsState.set([]);
    this.selectedElementIdsState.set(new Set());
    this.loadedEstablishmentId = id;
    this.loadElements(id, generation);
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
    if (selected && !this.elementsState().some((element) => element.id === elementId)) return;
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
    if (this.writesInFlight() > 0) return;
    const establishment = this.context.active();
    const establishmentId = establishment?.id ?? '';
    const elements = this.elementsState();
    if (
      this.context.status() !== 'ready' ||
      !establishment ||
      !establishmentId ||
      this.loadedEstablishmentId !== establishmentId
    )
      return;
    const person = this.personState();
    const timezone = establishment.timezone;
    const startsAt = this.toInstant(this.startsAtState(), timezone);
    const endsAt = this.toInstant(this.endsAtState(), timezone);
    const selectedIds = [...this.selectedElementIdsState()];
    const elementIds = selectedIds.filter((id) => elements.some((element) => element.id === id));

    if (!person) return this.fail(STRINGS.reservations.form.errors.customerRequired);
    if (!startsAt || !endsAt || startsAt >= endsAt)
      return this.fail(STRINGS.reservations.form.errors.invalidInterval);
    if (elementIds.length === 0 || elementIds.length !== selectedIds.length)
      return this.fail(STRINGS.reservations.form.errors.elementsRequired);

    const generation = this.generation;
    this.writesInFlight.update((count) => count + 1);
    this.submittingState.set(true);
    this.errorState.set(null);
    this.writeRequest = this.api
      .createReservation(establishmentId, {
        personId: person.id,
        spaceElementIds: new Set(elementIds),
        startsAt,
        endsAt,
      })
      .pipe(
        finalize(() => {
          this.writesInFlight.update((count) => Math.max(0, count - 1));
          if (generation === this.generation) this.submittingState.set(false);
        }),
      )
      .subscribe({
        next: (reservation) => {
          if (this.isCurrent(establishmentId, generation)) this.createdState.set(reservation);
        },
        error: (response: { status?: number }) => {
          if (!this.isCurrent(establishmentId, generation)) return;
          const errors = STRINGS.reservations.form.errors;
          this.errorState.set(
            response.status === 400
              ? errors.invalidRequest
              : response.status === 404
                ? errors.notFound
                : response.status === 409
                  ? errors.conflict
                  : errors.create,
          );
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

  private loadElements(id: string, generation: number): void {
    this.loadingState.set(true);
    this.errorState.set(null);
    this.elementsRequest = this.api
      .listReservableElements(id)
      .pipe(
        finalize(() => {
          if (generation === this.generation) this.loadingState.set(false);
        }),
      )
      .subscribe({
        next: (elements) => {
          if (this.isCurrent(id, generation)) this.elementsState.set(elements);
        },
        error: () => {
          if (this.isCurrent(id, generation))
            this.errorState.set(STRINGS.reservations.form.errors.loadElements);
        },
      });
  }

  private currentEstablishmentId(): string | null {
    const active = this.context.active();
    return this.context.status() === 'ready' && active?.id ? active.id : null;
  }

  private isCurrent(id: string, generation: number): boolean {
    return (
      generation === this.generation &&
      this.currentEstablishmentId() === id &&
      this.loadedEstablishmentId === id
    );
  }

  private resetForContext(): void {
    this.elementsRequest?.unsubscribe();
    this.elementsState.set([]);
    this.selectedElementIdsState.set(new Set());
    this.personState.set(null);
    this.startsAtState.set('');
    this.endsAtState.set('');
    this.loadingState.set(false);
    this.submittingState.set(false);
    this.errorState.set(null);
    this.createdState.set(null);
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
