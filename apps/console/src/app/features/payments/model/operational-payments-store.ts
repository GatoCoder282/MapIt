import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PaymentsService, type PaymentPage } from '@mapit/api-client';
import { EstablishmentContext } from '../../../core/establishment-context';

@Injectable()
export class OperationalPaymentsStore {
  private readonly api = inject(PaymentsService);
  private readonly context = inject(EstablishmentContext);
  private sequence = 0;
  readonly page = signal<PaymentPage | null>(null);
  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly offset = signal(0);
  readonly selectedPaymentId = signal<string | null>(null);
  readonly bankReference = signal('');
  readonly verifying = signal(false);
  readonly verificationError = signal(false);

  constructor() {
    effect(() => {
      const activeId = this.context.active()?.id;
      const contextStatus = this.context.status();
      if (!activeId && contextStatus === 'ready') this.page.set(null);
      this.offset.set(0);
      this.selectedPaymentId.set(null);
      this.bankReference.set('');
      untracked(() => void this.load());
    });
  }

  async load(): Promise<void> {
    const active = this.context.status() === 'ready' ? this.context.active() : null;
    const sequence = ++this.sequence;
    this.page.set(null);
    if (!active?.canManagePayments) {
      this.status.set('idle');
      return;
    }
    this.status.set('loading');
    try {
      const page = await firstValueFrom(
        this.api.listPayments({ establishmentId: active.id, limit: 20, offset: this.offset() }),
      );
      if (sequence !== this.sequence) return;
      this.page.set(page);
      this.status.set('ready');
    } catch {
      if (sequence === this.sequence) this.status.set('error');
    }
  }

  move(delta: number): void {
    const next = Math.max(0, this.offset() + delta);
    if (next === this.offset() || next >= (this.page()?.total ?? 0)) return;
    this.offset.set(next);
    void this.load();
  }

  select(paymentId: string): void {
    this.selectedPaymentId.set(paymentId);
    this.bankReference.set('');
    this.verificationError.set(false);
  }

  setBankReference(value: string): void {
    this.bankReference.set(value);
  }

  async verify(): Promise<void> {
    const paymentId = this.selectedPaymentId();
    const reference = this.bankReference().trim();
    const establishmentId = this.context.active()?.id;
    const payment = this.page()?.items.find((item) => item.id === paymentId);
    if (
      !paymentId ||
      !reference ||
      !establishmentId ||
      payment?.establishmentId !== establishmentId ||
      payment.provider !== 'STATIC_BANK_QR' ||
      payment.status !== 'PENDING_MANUAL_VERIFICATION' ||
      this.verifying()
    )
      return;
    this.verifying.set(true);
    this.verificationError.set(false);
    try {
      await firstValueFrom(
        this.api.verifyPayment({ paymentId, verifyPaymentRequest: { bankReference: reference } }),
      );
      this.selectedPaymentId.set(null);
      this.bankReference.set('');
      await this.load();
    } catch {
      this.verificationError.set(true);
    } finally {
      this.verifying.set(false);
    }
  }
}
