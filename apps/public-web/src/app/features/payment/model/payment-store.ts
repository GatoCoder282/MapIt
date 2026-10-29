import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, Injector, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  PREVIEW_CHECKOUT_PATH,
  PREVIEW_RECEIPT_PATH,
  formatDecimalMoney,
  type PublicCheckout,
  type PreviewPaymentStatus,
} from '@mapit/api-client';
import { Subject, firstValueFrom, takeUntil, timer } from 'rxjs';
import { STRINGS } from '../../../core/strings';
import { PublicRuntimeConfig } from '../../../core/runtime-config';
import { ReservationAccess } from '../../../core/reservation-access';
import {
  formatPaymentExpiry,
  formatReservationDate,
  formatReservationTime,
} from '../data/payment-format';
import { attemptUrl } from '../data/payment-qr';
import {
  PaymentPreviewApi,
  PaymentPreviewError,
  type CheckoutScope,
} from '../data/payment-preview-api';
import { projectCheckout } from '../data/payment-projection';
import { PublicPaymentApi, MissingReservationAccessError } from '../data/public-payment-api';

export type PaymentScenario = PreviewPaymentStatus | 'loading' | 'error';
export type PaymentPageStatus = 'loading' | 'loaded' | 'error' | 'unavailable' | 'not-found';

@Injectable()
export class PaymentStore {
  private readonly api = inject(PaymentPreviewApi);
  private readonly injector = inject(Injector);
  private readonly access = inject(ReservationAccess);
  private readonly runtime = inject(PublicRuntimeConfig);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cancelled = new Subject<void>();
  private readonly requestIds = new Map<string, string>();
  private requestVersion = 0;
  private refreshVersion = 0;
  private refreshAgain = false;
  private scope: CheckoutScope | null = null;
  private stopWatch: (() => void) | null = null;
  private issuingFor: string | null = null;
  readonly pageStatus = signal<PaymentPageStatus>('loading');
  readonly data = signal<PublicCheckout | null>(null);
  readonly scenario = signal<PaymentScenario>('PENDING');
  readonly selectedMethodId = signal('');
  readonly connection = signal<'connected' | 'reconnecting'>('reconnecting');
  readonly busy = signal(false);
  readonly refreshing = signal(false);
  readonly receiptStatus = signal<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  readonly actionError = signal<string | null>(null);
  readonly receiptPath = signal<string | null>(null);
  readonly previewEnabled = computed(() => this.api.allowed());
  readonly payment = computed(() => this.data()?.payment ?? null);
  readonly reservation = computed(() => this.data()?.reservation ?? null);
  readonly methods = computed(() => this.data()?.methods ?? []);
  readonly unavailableMessage = computed(() => {
    const data = this.data();
    if (!data || data.available || data.payment?.status === 'CONFIRMED') return null;
    const messages: Readonly<Record<string, string>> = STRINGS.payment.unavailableReasons;
    return messages[data.unavailableReason ?? ''] ?? STRINGS.payment.unavailable;
  });
  readonly selectedMethod = computed(
    () => this.methods().find((method) => method.id === this.selectedMethodId()) ?? null,
  );
  readonly canChooseMethod = computed(
    () =>
      !this.busy() &&
      (this.previewEnabled() ||
        !this.payment() ||
        ['FAILED', 'EXPIRED', 'CANCELLED'].includes(this.payment()!.status)),
  );
  readonly canStart = computed(
    () =>
      !this.previewEnabled() &&
      !!this.data()?.available &&
      !!this.selectedMethod() &&
      this.canChooseMethod(),
  );
  readonly canSimulate = computed(() => this.previewEnabled());
  /** Método del pago en curso cuando ya no es iniciable: proyección sustituida o deshabilitada. */
  readonly historicalMethod = computed(() => this.data()?.historicalMethod ?? null);
  readonly historicalAttempt = computed(() => {
    const data = this.data();
    const payment = this.payment();
    if (!data || !payment || data.methods.some((method) => method.provider === payment.provider))
      return null;
    return data.historicalMethod;
  });
  /** Enlace del QR del intento: solo cobro MOCK pendiente con simulación permitida. */
  readonly simulationLink = computed(() => {
    if (this.previewEnabled()) return null;
    const data = this.data();
    const payment = this.payment();
    const scope = this.scope;
    if (!data || !payment || !scope) return null;
    if (payment.status !== 'PENDING' || payment.provider !== 'MOCK_GATEWAY') return null;
    if (data.unavailableReason !== 'PAYMENT_PENDING') return null;
    const path =
      data.historicalMethod?.provider === payment.provider
        ? data.historicalMethod.simulationPath
        : null;
    const capability = this.access.read(scope);
    if (!path || !capability || !this.realApi().simulationAllowed()) return null;
    return attemptUrl(
      this.runtime.config().paymentPublicOrigin ?? 'http://localhost:4300',
      path,
      {
        tenantSlug: scope.tenantSlug,
        establishmentSlug: scope.establishmentSlug,
        reservationId: scope.reservationId,
        paymentId: payment.id,
      },
      capability,
    );
  });
  readonly statusLabel = computed(() =>
    this.payment()?.provider === 'MOCK_GATEWAY' && this.payment()?.status === 'CONFIRMED'
      ? STRINGS.payment.mockConfirmed
      : this.payment()
        ? STRINGS.payment.scenarios[this.payment()!.status]
        : STRINGS.payment.notStarted,
  );
  readonly statusDetail = computed(() =>
    this.payment()
      ? STRINGS.payment.statusDetails[this.payment()!.status]
      : STRINGS.payment.startHelp,
  );
  readonly deposit = computed(() => this.amount(this.data()?.amount));
  readonly total = computed(() => this.amount(this.data()?.totalAmount));
  readonly expiry = computed(() => {
    const payment = this.payment();
    const reservation = this.reservation();
    return payment?.expiresAt && reservation
      ? formatPaymentExpiry(payment.expiresAt, reservation.timezone)
      : '';
  });
  readonly date = computed(() =>
    this.reservation() ? formatReservationDate(this.reservation()!) : '',
  );
  readonly time = computed(() =>
    this.reservation() ? formatReservationTime(this.reservation()!) : '',
  );
  readonly sharePath = computed(() => {
    if (this.previewEnabled()) return PREVIEW_CHECKOUT_PATH;
    return this.scope && this.data()
      ? this.access.path(this.scope) + '#' + (this.access.fragment(this.scope) ?? '')
      : '';
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.requestVersion++;
      this.cancelled.next();
      this.cancelled.complete();
      this.stopWatch?.();
    });
  }

  async load(scope: CheckoutScope, scenario: PaymentScenario = this.scenario()): Promise<void> {
    const selected =
      scenario === 'CONFIRMED'
        ? this.selectedMethodId()
        : scenario === 'PENDING_MANUAL_VERIFICATION'
          ? 'demo-static'
          : 'demo-mock';
    const version = ++this.requestVersion;
    this.cancelled.next();
    this.stopWatch?.();
    this.stopWatch = null;
    this.scope = scope;
    this.issuingFor = null;
    this.receiptStatus.set('idle');
    this.refreshing.set(false);
    this.refreshAgain = false;
    this.receiptPath.set(null);
    this.actionError.set(null);
    this.scenario.set(scenario);
    this.data.set(null);
    this.busy.set(false);
    this.pageStatus.set('loading');
    try {
      if (this.previewEnabled()) {
        const preview = await firstValueFrom(
          this.api
            .checkout(scope, scenario === 'loading' || scenario === 'error' ? 'PENDING' : scenario)
            .pipe(takeUntil(this.cancelled), takeUntilDestroyed(this.destroyRef)),
        );
        if (version !== this.requestVersion) return;
        this.connection.set('connected');
        if (scenario === 'loading') return;
        if (scenario === 'error') {
          this.pageStatus.set('error');
          return;
        }
        this.accept(projectCheckout(preview));
        this.selectedMethodId.set(selected || 'demo-mock');
      } else {
        const checkout = await firstValueFrom(
          this.realApi()
            .checkout(scope)
            .pipe(takeUntil(this.cancelled), takeUntilDestroyed(this.destroyRef)),
        );
        if (version !== this.requestVersion) return;
        if (!this.matchesScope(checkout, scope)) throw new PaymentPreviewError('not-found');
        this.accept(checkout);
        this.stopWatch = this.realApi().watch(
          scope,
          () => {
            void this.refresh();
          },
          (connected) => this.connection.set(connected ? 'connected' : 'reconnecting'),
        );
      }
      this.pageStatus.set('loaded');
    } catch (error) {
      if (version === this.requestVersion) this.pageStatus.set(this.describe(error));
    }
  }

  chooseScenario(value: string): void {
    if (!this.previewEnabled() || !this.scope || !Object.hasOwn(STRINGS.payment.scenarios, value))
      return;
    void this.load(this.scope, value as PaymentScenario);
  }
  chooseMethod(id: string): void {
    if (!this.canChooseMethod() || !this.methods().some((method) => method.id === id)) return;
    this.selectedMethodId.set(id);
    if (!this.previewEnabled()) return;
    this.requestVersion++;
    this.cancelled.next();
    this.connection.set('connected');
    const data = this.data();
    if (!data?.payment) return;
    const status = id === 'demo-static' ? 'PENDING_MANUAL_VERIFICATION' : 'PENDING';
    this.scenario.set(status);
    this.receiptPath.set(null);
    this.data.set({
      ...data,
      reservation: { ...data.reservation, status: 'CREATED' },
      paidAmount: '0',
      payment: {
        ...data.payment,
        status,
        provider: id === 'demo-static' ? 'STATIC_BANK_QR' : 'MOCK_GATEWAY',
        paidAmount: '0',
      },
    });
  }

  async startPayment(): Promise<void> {
    if (!this.scope || !this.canStart()) return;
    const scope = this.scope;
    const version = this.requestVersion;
    const key = JSON.stringify([scope, this.selectedMethodId()]);
    const requestId = this.requestIds.get(key) ?? crypto.randomUUID();
    this.requestIds.set(key, requestId);
    this.busy.set(true);
    this.actionError.set(null);
    try {
      await firstValueFrom(
        this.realApi()
          .start(scope, this.selectedMethodId(), requestId)
          .pipe(takeUntil(this.cancelled), takeUntilDestroyed(this.destroyRef)),
      );
      if (version === this.requestVersion) await this.refresh();
    } catch {
      if (version === this.requestVersion) this.actionError.set(STRINGS.payment.actionError);
    } finally {
      if (version === this.requestVersion) this.busy.set(false);
    }
  }

  simulateConfirmation(): void {
    if (!this.previewEnabled() || !this.scope || this.busy()) return;
    void this.load(this.scope, 'CONFIRMED');
  }

  retry(): void {
    if (this.scope) void this.load(this.scope, 'PENDING');
  }
  async reconnect(): Promise<void> {
    if (
      !this.scope ||
      !this.data() ||
      this.refreshing() ||
      (this.connection() === 'reconnecting' && this.previewEnabled())
    )
      return;
    if (!this.previewEnabled()) {
      await this.refresh();
      return;
    }
    const version = this.requestVersion;
    this.connection.set('reconnecting');
    try {
      await firstValueFrom(
        timer(480).pipe(takeUntil(this.cancelled), takeUntilDestroyed(this.destroyRef)),
      );
      if (version !== this.requestVersion) return;
      const result = await firstValueFrom(
        this.api
          .checkout(this.scope, this.payment()?.status ?? 'PENDING')
          .pipe(takeUntil(this.cancelled), takeUntilDestroyed(this.destroyRef)),
      );
      if (version !== this.requestVersion) return;
      this.accept(projectCheckout(result));
      this.connection.set('connected');
    } catch {
      if (version === this.requestVersion) {
        this.connection.set('connected');
        this.pageStatus.set('error');
      }
    }
  }

  async refresh(): Promise<void> {
    if (!this.scope || this.previewEnabled()) return;
    if (this.refreshing()) {
      this.refreshAgain = true;
      return;
    }
    const version = this.requestVersion;
    const refresh = ++this.refreshVersion;
    this.refreshing.set(true);
    this.actionError.set(null);
    try {
      const scope = this.scope;
      const data = await firstValueFrom(
        this.realApi()
          .checkout(scope)
          .pipe(takeUntil(this.cancelled), takeUntilDestroyed(this.destroyRef)),
      );
      if (!this.matchesScope(data, scope)) throw new PaymentPreviewError('not-found');
      if (version === this.requestVersion && refresh === this.refreshVersion) this.accept(data);
    } catch (error) {
      if (version === this.requestVersion) {
        if (this.describe(error) === 'not-found') {
          this.stopWatch?.();
          this.stopWatch = null;
          this.refreshAgain = false;
          this.data.set(null);
          this.receiptPath.set(null);
          this.receiptStatus.set('idle');
          this.pageStatus.set('not-found');
        } else this.actionError.set(STRINGS.payment.loadError);
      }
    } finally {
      if (version === this.requestVersion && refresh === this.refreshVersion) {
        this.refreshing.set(false);
        if (this.refreshAgain) {
          this.refreshAgain = false;
          void this.refresh();
        }
      }
    }
  }

  receiptQueryParams(): Record<string, string> {
    return this.previewEnabled() || !this.scope
      ? {}
      : { tenantSlug: this.scope.tenantSlug, establishmentSlug: this.scope.establishmentSlug };
  }

  async issueReceipt(): Promise<void> {
    const payment = this.payment();
    const scope = this.scope;
    if (
      !scope ||
      !payment ||
      payment.status !== 'CONFIRMED' ||
      !['CONFIRMED', 'ACTIVE'].includes(this.reservation()?.status ?? '') ||
      this.previewEnabled() ||
      !!this.receiptPath() ||
      this.issuingFor === payment.id
    )
      return;
    const version = this.requestVersion;
    this.issuingFor = payment.id;
    this.receiptStatus.set('loading');
    this.actionError.set(null);
    try {
      const receipt = await firstValueFrom(
        this.realApi()
          .issueReceipt(scope)
          .pipe(takeUntil(this.cancelled), takeUntilDestroyed(this.destroyRef)),
      );
      if (
        version !== this.requestVersion ||
        this.payment()?.id !== payment.id ||
        this.payment()?.status !== 'CONFIRMED' ||
        !['CONFIRMED', 'ACTIVE'].includes(this.reservation()?.status ?? '')
      )
        return;
      if (
        !receipt.token ||
        !/^[A-Za-z0-9_-]{43}$/.test(receipt.token) ||
        receipt.payment.id !== payment.id ||
        receipt.payment.status !== 'CONFIRMED' ||
        receipt.reservation.id !== scope.reservationId ||
        receipt.reservation.tenantSlug !== scope.tenantSlug ||
        receipt.reservation.establishmentSlug !== scope.establishmentSlug ||
        !['CONFIRMED', 'ACTIVE'].includes(receipt.reservation.status)
      )
        throw new Error('invalid-receipt');
      this.receiptPath.set('/comprobante/' + receipt.token);
      this.receiptStatus.set('loaded');
    } catch {
      if (
        version === this.requestVersion &&
        this.payment()?.id === payment.id &&
        this.payment()?.status === 'CONFIRMED' &&
        ['CONFIRMED', 'ACTIVE'].includes(this.reservation()?.status ?? '')
      ) {
        this.issuingFor = null;
        this.receiptStatus.set('error');
        this.actionError.set(STRINGS.payment.receiptIssueError);
      }
    }
  }

  private accept(data: PublicCheckout): void {
    const previousPayment = this.payment();
    if (
      data.payment?.id !== this.payment()?.id ||
      data.payment?.status !== 'CONFIRMED' ||
      !['CONFIRMED', 'ACTIVE'].includes(data.reservation.status)
    ) {
      this.receiptPath.set(null);
      this.receiptStatus.set('idle');
      this.issuingFor = null;
    }
    this.data.set(data);
    if (
      !this.selectedMethodId() ||
      !data.methods.some((method) => method.id === this.selectedMethodId())
    )
      this.selectedMethodId.set(
        data.methods.find((method) => method.provider === data.payment?.provider)?.id ??
          data.methods[0]?.id ??
          '',
      );
    if (
      !this.previewEnabled() &&
      this.scope &&
      data.payment &&
      ['FAILED', 'EXPIRED', 'CANCELLED'].includes(data.payment.status) &&
      (previousPayment?.id !== data.payment.id || previousPayment.status !== data.payment.status)
    ) {
      for (const key of this.requestIds.keys()) {
        if (key.startsWith('[' + JSON.stringify(this.scope) + ',')) this.requestIds.delete(key);
      }
    }
    if (
      data.payment?.status === 'CONFIRMED' &&
      ['CONFIRMED', 'ACTIVE'].includes(data.reservation.status)
    ) {
      if (this.previewEnabled()) {
        this.receiptPath.set(PREVIEW_RECEIPT_PATH);
        this.receiptStatus.set('loaded');
      } else void this.issueReceipt();
    }
  }
  private amount(value: string | null | undefined): string {
    const currency = this.data()?.currency;
    return value != null && currency ? formatDecimalMoney(value, currency) : '';
  }
  private realApi(): PublicPaymentApi {
    return this.injector.get(PublicPaymentApi);
  }
  private matchesScope(data: PublicCheckout, scope: CheckoutScope): boolean {
    return (
      data.reservation.id === scope.reservationId &&
      data.reservation.tenantSlug === scope.tenantSlug &&
      data.reservation.establishmentSlug === scope.establishmentSlug
    );
  }
  private describe(error: unknown): PaymentPageStatus {
    if (error instanceof MissingReservationAccessError) return 'not-found';
    if (error instanceof PaymentPreviewError) return error.kind;
    if (error instanceof HttpErrorResponse && [403, 404, 410].includes(error.status))
      return 'not-found';
    return 'error';
  }
}
