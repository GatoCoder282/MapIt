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

  constructor() {
    effect(() => {
      const activeId = this.context.active()?.id;
      const contextStatus = this.context.status();
      if (!activeId && contextStatus === 'ready') this.page.set(null);
      this.offset.set(0);
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
}
