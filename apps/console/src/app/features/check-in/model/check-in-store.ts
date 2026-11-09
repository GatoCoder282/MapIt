import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
  type Signal,
  untracked,
} from '@angular/core';
import {
  PREVIEW_ESTABLISHMENT_ID,
  PREVIEW_RECEIPT_TOKEN,
  formatDecimalMoney,
  parsePreviewReceiptToken,
  previewReservation,
} from '@mapit/api-client';
import { currentLocaleTag } from '@mapit/i18n';
import { EstablishmentContext } from '../../../core/establishment-context';
import { STRINGS } from '../../../core/strings';
import {
  CheckInApi,
  CheckInError,
  type CheckInResult,
  type CheckInScenario,
} from '../data/check-in-api';

@Injectable()
export class CheckInStore {
  private readonly api = inject(CheckInApi);
  private readonly context = inject(EstablishmentContext);
  private requestVersion = 0;
  private contextGeneration = 0;
  private loadedEstablishmentId: string | null = null;
  private stopWatch: (() => void) | null = null;
  private readonly inputState = signal('');
  private readonly resultState = signal<CheckInResult | null>(null);
  private readonly queryingState = signal(false);
  private readonly arrivingState = signal(false);
  private readonly arrivalsInFlight = signal(0);
  private readonly errorState = signal<string | null>(null);
  readonly enabled = this.api.enabled;
  readonly preview = this.api.preview;
  readonly authorized = this.api.authorized;
  readonly input = this.inputState.asReadonly();
  readonly establishmentId = computed(() => this.context.active()?.id ?? '');
  readonly result = this.resultState.asReadonly();
  readonly querying = this.queryingState.asReadonly();
  readonly arriving = this.arrivingState.asReadonly();
  readonly busy: Signal<boolean> = computed(() => this.arrivalsInFlight() > 0);
  readonly dirty = computed(() => !!this.inputState() || this.resultState() !== null);
  readonly error = this.errorState.asReadonly();
  readonly scenario = this.api.scenario;
  readonly demoEstablishmentId = PREVIEW_ESTABLISHMENT_ID;
  readonly demoEstablishmentName = previewReservation().establishmentName;
  readonly canCheckIn = computed(
    () => this.context.status() === 'ready' && this.context.active()?.canCheckIn === true,
  );
  readonly canArrive = computed(
    () =>
      this.enabled() &&
      this.authorized() &&
      this.canCheckIn() &&
      this.hasCurrentContext() &&
      !!this.result() &&
      !this.result()?.eligibilityError &&
      this.result()?.receipt.checkIn === 'NOT_CHECKED_IN' &&
      !this.querying() &&
      !this.arriving() &&
      this.arrivalsInFlight() === 0,
  );
  readonly eligibilityMessage = computed(() => {
    const code = this.result()?.eligibilityError;
    return code ? STRINGS.checkIn.errors[code] : null;
  });
  readonly onScan = (value: string): void => {
    void this.scan(value);
  };
  readonly scenarios: readonly CheckInScenario[] = [
    'ready',
    'invalid',
    'expired',
    'revoked',
    'cancelled',
    'pending',
    'window',
    'wrongVenue',
  ];

  constructor() {
    effect((onCleanup) => {
      const status = this.context.status();
      const active = this.context.active();
      const authorized = this.authorized();
      const establishmentId =
        status === 'ready' && authorized && active?.canCheckIn ? active.id : null;
      const contextGeneration = ++this.contextGeneration;
      this.requestVersion++;
      this.loadedEstablishmentId = establishmentId;
      this.inputState.set('');
      this.resultState.set(null);
      this.queryingState.set(false);
      this.arrivingState.set(false);
      this.errorState.set(null);
      this.stopWatch?.();
      this.stopWatch = null;
      if (establishmentId && !this.preview()) {
        const watchedId = establishmentId;
        this.stopWatch = untracked(() =>
          this.api.watch(watchedId, (reservationId) => {
            if (
              contextGeneration === this.contextGeneration &&
              this.hasCurrentContext() &&
              this.result() &&
              !this.arriving() &&
              !this.querying() &&
              (!reservationId || reservationId === this.result()?.receipt.reservation.id)
            )
              void this.query();
          }),
        );
      }
      onCleanup(() => {
        this.stopWatch?.();
        this.stopWatch = null;
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.requestVersion++;
      this.contextGeneration++;
      this.stopWatch?.();
      this.stopWatch = null;
    });
  }

  reservationLabel(status: string): string {
    const labels: Readonly<Record<string, string>> = STRINGS.checkIn.reservationStates;
    return labels[status] ?? status;
  }
  paymentLabel(status: string): string {
    const labels: Readonly<Record<string, string>> = STRINGS.checkIn.paymentStates;
    return labels[status] ?? status;
  }
  spaceLabel(status: string): string {
    const labels: Readonly<Record<string, string>> = STRINGS.checkIn.spaceStates;
    return labels[status] ?? status;
  }
  formatMoney(value: string, currency: string): string {
    return formatDecimalMoney(value, currency);
  }

  setInput(value: string): void {
    if (this.arriving()) return;
    this.inputState.set(value);
    this.invalidate();
  }

  setScenario(value: string): void {
    if (this.arriving() || !this.scenarios.some((scenario) => scenario === value)) return;
    const scenario = this.scenarios.find((item) => item === value)!;
    try {
      if (!this.hasCurrentContext() || !this.canCheckIn()) return;
      this.api.setScenario(scenario);
      this.invalidate();
    } catch (error) {
      this.errorState.set(this.message(error));
    }
  }

  useDemoCode(): void {
    this.setInput(PREVIEW_RECEIPT_TOKEN);
  }

  clear(): void {
    if (this.arriving()) return;
    this.inputState.set('');
    this.invalidate();
  }

  async scan(value: string): Promise<void> {
    if (this.arriving()) return;
    this.setInput(value);
    await this.query();
  }

  async query(): Promise<void> {
    if (this.arriving()) return;
    const establishmentId = this.currentEstablishmentId();
    const version = ++this.requestVersion;
    this.queryingState.set(false);
    this.resultState.set(null);
    this.errorState.set(null);
    if (!this.enabled() || !this.authorized() || !this.canCheckIn() || !establishmentId) {
      this.errorState.set(
        this.enabled() ? STRINGS.checkIn.errors.forbidden : STRINGS.checkIn.errors.unavailable,
      );
      return;
    }
    const token = parsePreviewReceiptToken(this.input(), this.api.publicOrigin());
    if (!token) {
      this.errorState.set(STRINGS.checkIn.errors.invalid);
      return;
    }
    this.queryingState.set(true);
    try {
      const result = await this.api.lookup(token, establishmentId);
      if (this.isCurrent(establishmentId, version)) this.resultState.set(result);
    } catch (error) {
      if (this.isCurrent(establishmentId, version)) this.errorState.set(this.message(error));
    } finally {
      if (version === this.requestVersion) this.queryingState.set(false);
    }
  }

  async arrive(): Promise<void> {
    if (!this.canArrive()) return;
    const establishmentId = this.currentEstablishmentId();
    const result = this.result();
    if (!result || !establishmentId) return;
    const version = ++this.requestVersion;
    this.arrivalsInFlight.update((count) => count + 1);
    this.arrivingState.set(true);
    this.errorState.set(null);
    try {
      const arrived = await this.api.arrive(result.receipt.token, establishmentId);
      if (this.isCurrent(establishmentId, version)) this.resultState.set(arrived);
    } catch (error) {
      if (this.isCurrent(establishmentId, version)) {
        this.resultState.set(null);
        this.errorState.set(this.message(error));
      }
    } finally {
      this.arrivalsInFlight.update((count) => Math.max(0, count - 1));
      if (version === this.requestVersion) this.arrivingState.set(false);
    }
  }

  formatDate(value: string, timeZone: string): string {
    return new Intl.DateTimeFormat(currentLocaleTag(), {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(new Date(value));
  }

  private currentEstablishmentId(): string | null {
    return this.hasCurrentContext() ? this.context.active()!.id : null;
  }
  private hasCurrentContext(): boolean {
    const active = this.context.active();
    return (
      this.context.status() === 'ready' &&
      !!active?.canCheckIn &&
      !!active.id &&
      this.loadedEstablishmentId === active.id
    );
  }
  private isCurrent(id: string, version: number): boolean {
    return version === this.requestVersion && this.currentEstablishmentId() === id;
  }
  private invalidate(): void {
    this.requestVersion++;
    this.resultState.set(null);
    this.queryingState.set(false);
    this.errorState.set(null);
  }
  private message(error: unknown): string {
    return error instanceof CheckInError
      ? STRINGS.checkIn.errors[error.code]
      : STRINGS.checkIn.errors.request;
  }
}
