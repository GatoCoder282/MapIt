import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import {
  PREVIEW_ESTABLISHMENT_ID,
  PREVIEW_RECEIPT_TOKEN,
  parsePreviewReceiptToken,
  previewReservation,
  formatDecimalMoney,
} from '@mapit/api-client';
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
  private requestVersion = 0;
  private stopWatch: (() => void) | null = null;
  private readonly inputState = signal('');
  private readonly establishmentState = signal('');
  private readonly resultState = signal<CheckInResult | null>(null);
  private readonly queryingState = signal(false);
  private readonly arrivingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  readonly enabled = this.api.enabled;
  readonly preview = this.api.preview;
  readonly authorized = this.api.authorized;
  readonly input = this.inputState.asReadonly();
  readonly establishmentId = this.establishmentState.asReadonly();
  readonly result = this.resultState.asReadonly();
  readonly querying = this.queryingState.asReadonly();
  readonly arriving = this.arrivingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly scenario = this.api.scenario;
  readonly demoEstablishmentId = PREVIEW_ESTABLISHMENT_ID;
  readonly demoEstablishmentName = previewReservation().establishmentName;
  readonly establishments = signal<readonly { id: string; name: string }[]>([]);
  readonly venuesError = signal(false);
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
  readonly canArrive = computed(
    () =>
      this.enabled() &&
      this.authorized() &&
      !!this.result() &&
      !this.result()?.eligibilityError &&
      this.result()?.receipt.checkIn === 'NOT_CHECKED_IN' &&
      !this.querying() &&
      !this.arriving(),
  );
  readonly eligibilityMessage = computed(() => {
    const code = this.result()?.eligibilityError;
    return code ? STRINGS.checkIn.errors[code] : null;
  });

  constructor() {
    if (this.api.authorized()) void this.loadEstablishments();
    inject(DestroyRef).onDestroy(() => {
      this.requestVersion++;
      this.stopWatch?.();
    });
  }

  async loadEstablishments(): Promise<void> {
    this.venuesError.set(false);
    try {
      this.establishments.set(await this.api.establishments());
    } catch {
      this.venuesError.set(true);
    }
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

  selectEstablishment(value: string): void {
    if (this.arriving()) return;
    this.establishmentState.set(value);
    this.invalidate();
    this.stopWatch?.();
    this.stopWatch = null;
    if (value && !this.preview())
      this.stopWatch = this.api.watch(value, (reservationId) => {
        if (
          this.result() &&
          !this.arriving() &&
          !this.querying() &&
          (!reservationId || reservationId === this.result()?.receipt.reservation.id)
        )
          void this.query();
      });
  }

  setScenario(value: string): void {
    if (this.arriving() || !this.scenarios.some((scenario) => scenario === value)) return;
    const scenario = this.scenarios.find((item) => item === value)!;
    try {
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
    const version = ++this.requestVersion;
    this.queryingState.set(false);
    this.resultState.set(null);
    this.errorState.set(null);
    if (!this.enabled() || !this.authorized()) {
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
      const result = await this.api.lookup(token, this.establishmentId());
      if (version === this.requestVersion) this.resultState.set(result);
    } catch (error) {
      if (version === this.requestVersion) this.errorState.set(this.message(error));
    } finally {
      if (version === this.requestVersion) this.queryingState.set(false);
    }
  }

  async arrive(): Promise<void> {
    if (!this.canArrive()) return;
    const result = this.result();
    if (!result) return;
    const version = ++this.requestVersion;
    this.arrivingState.set(true);
    this.errorState.set(null);
    try {
      const arrived = await this.api.arrive(result.receipt.token, this.establishmentId());
      if (version === this.requestVersion) this.resultState.set(arrived);
    } catch (error) {
      if (version === this.requestVersion) {
        this.resultState.set(null);
        this.errorState.set(this.message(error));
      }
    } finally {
      if (version === this.requestVersion) this.arrivingState.set(false);
    }
  }

  formatDate(value: string, timeZone: string): string {
    return new Intl.DateTimeFormat('es', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(new Date(value));
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
