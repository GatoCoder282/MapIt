import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { LucideArrowLeft, LucideQrCode } from '@lucide/angular';
import { formatDecimalMoney, SimulatePaymentRequest, type PublicCheckout } from '@mapit/api-client';
import { firstValueFrom } from 'rxjs';

import { STRINGS } from '../../../core/strings';
import { ReservationAccess } from '../../../core/reservation-access';
import { PublicPaymentApi } from '../data/public-payment-api';
import { parseAttempt } from '../data/payment-qr';
import {
  formatPaymentExpiry,
  formatReservationDate,
  formatReservationTime,
} from '../data/payment-format';

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Destino del QR. El QR de configuración es informativo; el QR de un intento
 * concreto valida scope, pago y capability localmente y ofrece acciones
 * explícitas. Abrir o escanear nunca envía un evento: confirmar o cancelar
 * exige una acción del usuario sobre ese único intento.
 */
@Component({
  selector: 'mp-simulation-page',
  imports: [RouterLink, LucideArrowLeft, LucideQrCode],
  templateUrl: './simulation-page.html',
  styleUrls: ['./payment-pages.scss', './simulation-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationPage {
  readonly token = input.required<string>();
  protected readonly strings = STRINGS.qrSimulation;
  protected readonly paymentStrings = STRINGS.payment;
  protected readonly brand = STRINGS.payment.brand;
  protected readonly outcomes = SimulatePaymentRequest.OutcomeEnum;
  private readonly access = inject(ReservationAccess);
  private readonly api = inject(PublicPaymentApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap, { initialValue: null });
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment, { initialValue: null });

  protected readonly busy = signal(false);
  protected readonly result = computed(() => {
    const status = this.checkout()?.payment?.status;
    return this.verified() &&
      (status === 'CONFIRMED' ||
        status === 'CANCELLED' ||
        status === 'FAILED' ||
        status === 'EXPIRED' ||
        status === 'RECONCILIATION_REQUIRED')
      ? status
      : null;
  });
  protected readonly amount = computed(() => {
    const payment = this.checkout()?.payment;
    return payment ? formatDecimalMoney(payment.amount, payment.currency) : '';
  });
  protected readonly date = computed(() =>
    this.checkout() ? formatReservationDate(this.checkout()!.reservation) : '',
  );
  protected readonly time = computed(() =>
    this.checkout() ? formatReservationTime(this.checkout()!.reservation) : '',
  );
  protected readonly expiry = computed(() => {
    const data = this.checkout();
    return data?.payment?.expiresAt
      ? formatPaymentExpiry(data.payment.expiresAt, data.reservation.timezone)
      : '';
  });
  protected readonly actionError = signal(false);
  protected readonly checkoutState = signal<'idle' | 'loading' | 'loaded' | 'invalid' | 'error'>(
    'idle',
  );
  private checkoutVersion = 0;

  protected readonly valid = computed(() => TOKEN.test(this.token()));
  protected readonly attempt = computed(() => {
    const params = this.query();
    if (!params) return null;
    const query = new URLSearchParams();
    for (const key of params.keys) query.set(key, params.get(key)!);
    return parseAttempt(this.token(), query, this.fragment());
  });
  protected readonly hasAttemptContext = computed(() => {
    const params = this.query();
    return (!!params && params.keys.length > 0) || !!this.fragment();
  });
  protected readonly allowed = computed(() => this.api.simulationAllowed());
  protected readonly verified = computed(() => {
    const attempt = this.attempt();
    const checkout = this.checkout();
    return this.isVerified(checkout, attempt);
  });
  protected readonly canSimulate = computed(
    () =>
      this.allowed() &&
      this.verified() &&
      this.checkoutState() === 'loaded' &&
      this.checkout()?.payment?.status === 'PENDING',
  );
  protected readonly checkout = signal<PublicCheckout | null>(null);
  protected readonly checkoutLink = computed(() => {
    const attempt = this.attempt();
    if (!attempt || !this.verified()) return null;
    const scope = {
      tenantSlug: attempt.tenantSlug,
      establishmentSlug: attempt.establishmentSlug,
      reservationId: attempt.reservationId,
    };
    return this.access.path(scope) + '#access=' + attempt.capability;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.checkoutVersion++);
    effect(() => {
      const attempt = this.attempt();
      untracked(() => {
        const version = ++this.checkoutVersion;
        this.checkout.set(null);
        this.checkoutState.set(attempt ? 'loading' : 'idle');
        this.busy.set(false);
        this.actionError.set(false);
        if (!attempt) return;
        const scope = {
          tenantSlug: attempt.tenantSlug,
          establishmentSlug: attempt.establishmentSlug,
          reservationId: attempt.reservationId,
        };
        if (!this.access.save(scope, attempt.capability, null)) {
          this.checkoutState.set('error');
          return;
        }
        void this.loadCheckout(scope, version);
      });
    });
  }

  private async loadCheckout(
    scope: { tenantSlug: string; establishmentSlug: string; reservationId: string },
    version: number,
  ): Promise<void> {
    try {
      const checkout = await firstValueFrom(
        this.api.checkout(scope).pipe(takeUntilDestroyed(this.destroyRef)),
      );
      if (version !== this.checkoutVersion) return;
      this.checkout.set(checkout);
      this.checkoutState.set(this.isVerified(checkout, this.attempt()) ? 'loaded' : 'invalid');
    } catch {
      if (version === this.checkoutVersion) this.checkoutState.set('error');
    }
  }

  private isVerified(
    checkout: PublicCheckout | null,
    attempt: ReturnType<typeof parseAttempt>,
  ): boolean {
    if (!checkout || !attempt) return false;
    return (
      checkout.reservation.id === attempt.reservationId &&
      checkout.reservation.tenantSlug === attempt.tenantSlug &&
      checkout.reservation.establishmentSlug === attempt.establishmentSlug &&
      checkout.payment?.id === attempt.paymentId &&
      checkout.payment.provider === 'MOCK_GATEWAY' &&
      (['CONFIRMED', 'CANCELLED', 'FAILED', 'EXPIRED', 'RECONCILIATION_REQUIRED'].includes(
        checkout.payment.status,
      ) ||
        (checkout.payment.status === 'PENDING' &&
          checkout.unavailableReason === 'PAYMENT_PENDING' &&
          checkout.historicalMethod?.provider === 'MOCK_GATEWAY' &&
          checkout.historicalMethod.simulationPath === '/simulacion/qr/' + this.token()))
    );
  }

  protected async simulate(outcome: 'CONFIRMED' | 'CANCELLED'): Promise<void> {
    const attempt = this.attempt();
    if (!attempt || !this.canSimulate() || this.busy() || this.result()) return;
    const version = this.checkoutVersion;
    this.busy.set(true);
    this.actionError.set(false);
    try {
      await firstValueFrom(
        this.api
          .simulate(
            {
              tenantSlug: attempt.tenantSlug,
              establishmentSlug: attempt.establishmentSlug,
              reservationId: attempt.reservationId,
            },
            attempt.paymentId,
            outcome,
          )
          .pipe(takeUntilDestroyed(this.destroyRef)),
      );
      if (version !== this.checkoutVersion) return;
      await this.loadCheckout(
        {
          tenantSlug: attempt.tenantSlug,
          establishmentSlug: attempt.establishmentSlug,
          reservationId: attempt.reservationId,
        },
        version,
      );
    } catch {
      if (version === this.checkoutVersion) this.actionError.set(true);
    } finally {
      if (version === this.checkoutVersion) this.busy.set(false);
    }
  }
}
