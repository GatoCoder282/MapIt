import { Injectable, Injector, computed, inject, isDevMode, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthSession } from '@mapit/auth';
import {
  PREVIEW_ESTABLISHMENT_ID,
  PREVIEW_RECEIPT_TOKEN,
  PREVIEW_TENANT_ID,
  paymentPreviewAllowed,
  previewReceipt,
  type PaymentReceipt,
  type CheckInDetails,
  CheckInsService,
  EstablishmentsService,
  projectReceipt,
} from '@mapit/api-client';
import { firstValueFrom } from 'rxjs';
import { RealtimeClient } from '@mapit/realtime';
import { toObservable } from '@angular/core/rxjs-interop';
import { RuntimeConfigStore } from '../../../core/runtime-config';

export type CheckInScenario =
  'ready' | 'invalid' | 'expired' | 'revoked' | 'cancelled' | 'pending' | 'window' | 'wrongVenue';
export type CheckInErrorCode =
  Exclude<CheckInScenario, 'ready'> | 'unavailable' | 'forbidden' | 'venueRequired' | 'conflict';
export class CheckInError extends Error {
  constructor(readonly code: CheckInErrorCode) {
    super(code);
  }
}
export interface PreviewArrivalAudit {
  readonly actorId: string;
  readonly occurredAt: string;
  readonly establishmentId: string;
  readonly spaceIds: readonly string[];
}
export interface CheckInResult {
  readonly receipt: PaymentReceipt & { token: string };
  readonly eligibilityError: CheckInErrorCode | null;
  readonly audit: PreviewArrivalAudit | null;
}

/** Adaptador SINTÉTICO opt-in. No hay fallback ni HTTP financiero/operativo. */
@Injectable({ providedIn: 'root' })
export class CheckInApi {
  private readonly runtime = inject(RuntimeConfigStore);
  private readonly session = inject(AuthSession);
  private readonly injector = inject(Injector);
  readonly preview = computed(() => paymentPreviewAllowed(this.runtime.config(), isDevMode()));
  readonly enabled = computed(() => true);
  readonly authorized = computed(() => {
    const user = this.session.user();
    return (
      !!user &&
      (!this.preview() || user.tenantId === PREVIEW_TENANT_ID) &&
      ['ADMIN', 'STAFF'].includes(user.role)
    );
  });
  readonly publicOrigin = computed(
    () => this.runtime.config().paymentPublicOrigin ?? 'http://localhost:4300',
  );
  private readonly scenarioState = signal<CheckInScenario>('ready');
  readonly scenario = this.scenarioState.asReadonly();
  private receipt = previewReceipt();
  private audit: PreviewArrivalAudit | null = null;

  setScenario(scenario: CheckInScenario): void {
    this.requireAccess();
    if (!this.preview()) throw new CheckInError('unavailable');
    this.scenarioState.set(scenario);
    this.receipt = previewReceipt();
    this.audit = null;
    if (scenario === 'cancelled')
      this.receipt = {
        ...this.receipt,
        reservation: { ...this.receipt.reservation, status: 'CANCELLED' },
      };
    if (scenario === 'pending')
      this.receipt = {
        ...this.receipt,
        payment: { ...this.receipt.payment, status: 'PENDING_MANUAL_VERIFICATION', paidMinor: 0 },
      };
    if (scenario === 'revoked') this.receipt = { ...this.receipt, revoked: true };
    if (scenario === 'wrongVenue')
      this.receipt = {
        ...this.receipt,
        reservation: { ...this.receipt.reservation, establishmentId: 'demo-other-establishment' },
      };
  }

  async lookup(token: string, establishmentId: string): Promise<CheckInResult> {
    if (!this.preview()) return this.realRequest(token, establishmentId, false);
    this.requireRequest(token, establishmentId);
    await this.feedbackDelay();
    this.requireRequest(token, establishmentId);
    const scenario = this.scenario();
    if (scenario === 'invalid' || scenario === 'expired' || scenario === 'revoked') {
      throw new CheckInError(scenario);
    }
    return this.result(establishmentId);
  }

  async arrive(token: string, establishmentId: string): Promise<CheckInResult> {
    if (!this.preview()) return this.realRequest(token, establishmentId, true);
    this.requireRequest(token, establishmentId);
    await this.feedbackDelay();
    this.requireRequest(token, establishmentId);
    // Revalidar tras la espera: el operador o el escenario pueden haber cambiado.
    const result = this.result(establishmentId);
    if (result.eligibilityError) throw new CheckInError(result.eligibilityError);
    if (this.receipt.checkIn === 'CHECKED_IN') return result;
    this.receipt = {
      ...this.receipt,
      checkIn: 'CHECKED_IN',
      reservation: {
        ...this.receipt.reservation,
        status: 'ACTIVE',
        spaces: this.receipt.reservation.spaces.map((space) => ({ ...space, state: 'OCCUPIED' })),
      },
    };
    this.audit = {
      actorId: this.session.user()!.id,
      occurredAt: new Date().toISOString(),
      establishmentId,
      spaceIds: this.receipt.reservation.spaces.map((space) => space.id),
    };
    return this.result(establishmentId);
  }

  private result(establishmentId: string): CheckInResult {
    const scenario = this.scenario();
    let eligibilityError: CheckInErrorCode | null = null;
    if (scenario === 'invalid' || scenario === 'expired' || scenario === 'revoked')
      eligibilityError = scenario;
    else if (this.receipt.reservation.establishmentId !== establishmentId)
      eligibilityError = 'wrongVenue';
    else if (
      this.receipt.reservation.status === 'CANCELLED' ||
      this.receipt.reservation.status === 'RELEASED'
    )
      eligibilityError = 'cancelled';
    else if (
      this.receipt.payment.status !== 'CONFIRMED' ||
      this.receipt.payment.paidMinor < this.receipt.payment.amountMinor
    )
      eligibilityError = 'pending';
    else if (scenario === 'window') eligibilityError = 'window';
    else if (
      this.receipt.reservation.status !== 'CONFIRMED' &&
      this.receipt.checkIn !== 'CHECKED_IN'
    )
      eligibilityError = 'conflict';
    return {
      receipt: { ...projectReceipt(this.receipt), token: this.receipt.token },
      eligibilityError,
      audit: this.audit,
    };
  }

  async establishments(): Promise<readonly { id: string; name: string }[]> {
    this.requireAccess();
    if (this.preview())
      return [{ id: PREVIEW_ESTABLISHMENT_ID, name: this.receipt.reservation.establishmentName }];
    const venues = await firstValueFrom(
      this.injector.get(EstablishmentsService).listAccessibleEstablishments(),
    );
    return venues
      .filter((venue) => venue.canCheckIn)
      .map((venue) => ({ id: venue.id, name: venue.name }));
  }
  watch(establishmentId: string, refresh: (reservationId: string | null) => void): () => void {
    if (this.preview()) return () => undefined;
    const realtime = this.injector.get(RealtimeClient);
    realtime.connect();
    const events = realtime
      .subscribeEstablishmentPayments(establishmentId)
      .subscribe((event) => refresh(event.reservationId));
    const connection = toObservable(realtime.connectionState, {
      injector: this.injector,
    }).subscribe((state) => {
      if (state === 'connected') refresh(null);
    });
    return () => {
      events.unsubscribe();
      connection.unsubscribe();
    };
  }

  private async realRequest(
    token: string,
    establishmentId: string,
    arrive: boolean,
  ): Promise<CheckInResult> {
    this.requireAccess();
    if (!establishmentId) throw new CheckInError('venueRequired');
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new CheckInError('invalid');
    try {
      const client = this.injector.get(CheckInsService);
      const request = { establishmentId, receiptTokenRequest: { token } };
      const details: CheckInDetails = await firstValueFrom(
        arrive ? client.registerCheckIn(request) : client.lookupCheckIn(request),
      );
      this.requireAccess();
      if (details.receipt.reservation.establishmentId !== establishmentId)
        throw new CheckInError('wrongVenue');
      const receipt = { ...details.receipt, token };
      const eligibilityError = ['CANCELLED', 'RELEASED'].includes(receipt.reservation.status)
        ? 'cancelled'
        : receipt.payment.status !== 'CONFIRMED'
          ? 'pending'
          : !['CONFIRMED', 'ACTIVE'].includes(receipt.reservation.status)
            ? 'conflict'
            : null;
      return { receipt, eligibilityError, audit: details.audit };
    } catch (error) {
      if (error instanceof CheckInError) throw error;
      if (error instanceof HttpErrorResponse) {
        const problem: unknown = error.error;
        const kind =
          problem &&
          typeof problem === 'object' &&
          'type' in problem &&
          typeof problem.type === 'string'
            ? problem.type
            : '';
        const code = kind.includes('window')
          ? 'window'
          : kind.includes('revok')
            ? 'revoked'
            : kind.includes('cancel')
              ? 'cancelled'
              : kind.includes('payment')
                ? 'pending'
                : error.status === 403
                  ? 'forbidden'
                  : error.status === 410
                    ? 'expired'
                    : error.status === 404
                      ? 'invalid'
                      : 'conflict';
        throw new CheckInError(code);
      }
      throw error;
    }
  }

  private requireAccess(): void {
    if (!this.enabled()) throw new CheckInError('unavailable');
    if (!this.authorized()) throw new CheckInError('forbidden');
  }

  private requireRequest(token: string, establishmentId: string): void {
    this.requireAccess();
    if (!establishmentId) throw new CheckInError('venueRequired');
    if (establishmentId !== PREVIEW_ESTABLISHMENT_ID) throw new CheckInError('wrongVenue');
    if (token !== PREVIEW_RECEIPT_TOKEN) throw new CheckInError('invalid');
  }

  private feedbackDelay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 160));
  }
}
