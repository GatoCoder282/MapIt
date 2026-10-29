import { TestBed } from '@angular/core/testing';
import { PREVIEW_RECEIPT_TOKEN, previewReceipt, projectReceipt } from '@mapit/api-client';
import { Subject, of } from 'rxjs';

import { PaymentPreviewApi } from '../data/payment-preview-api';
import { ReceiptStore } from './receipt-store';
import { PublicPaymentApi } from '../data/public-payment-api';

describe('ReceiptStore', () => {
  let api: { allowed: ReturnType<typeof vi.fn>; receipt: ReturnType<typeof vi.fn> };
  let store: ReceiptStore;
  let real: { receipt: ReturnType<typeof vi.fn>; watch: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    real = {
      receipt: vi.fn(() => of(projectReceipt(previewReceipt()))),
      watch: vi.fn(() => () => undefined),
    };
    api = { allowed: vi.fn(() => true), receipt: vi.fn(() => of(previewReceipt())) };
    TestBed.configureTestingModule({
      providers: [
        ReceiptStore,
        { provide: PaymentPreviewApi, useValue: api },
        { provide: PublicPaymentApi, useValue: real },
      ],
    });
    store = TestBed.inject(ReceiptStore);
  });
  afterEach(() => TestBed.resetTestingModule());

  it('distingue anticipo verificado de saldo y total', async () => {
    await store.load(PREVIEW_RECEIPT_TOKEN);
    expect(store.pageStatus()).toBe('loaded');
    expect(store.paid()).toContain('120');
    expect(store.balance()).toContain('280');
    expect(store.total()).toContain('400');
  });

  it('consulta el servidor por defecto sin fallback a demo', async () => {
    api.allowed.mockReturnValue(false);
    await store.load(PREVIEW_RECEIPT_TOKEN, 'demo', 'la-bahia');
    expect(api.receipt).not.toHaveBeenCalled();
    expect(store.pageStatus()).toBe('loaded');
    expect(real.receipt).toHaveBeenCalledWith('demo', 'la-bahia', PREVIEW_RECEIPT_TOKEN);
  });
  it('acepta reserva activa después de llegada sin inventar total ni saldo', async () => {
    api.allowed.mockReturnValue(false);
    const receipt = projectReceipt(previewReceipt());
    real.receipt.mockReturnValue(
      of({
        ...receipt,
        totalAmount: null,
        balanceAmount: null,
        reservation: { ...receipt.reservation, status: 'ACTIVE' },
        checkIn: 'CHECKED_IN',
      }),
    );
    await store.load(PREVIEW_RECEIPT_TOKEN, 'demo', 'la-bahia');
    expect(store.pageStatus()).toBe('loaded');
    expect(store.total()).toBe('');
    expect(store.balance()).toBe('');
  });

  it('reconsulta llegada por STOMP y libera la suscripción al destruirse', async () => {
    api.allowed.mockReturnValue(false);
    const stop = vi.fn();
    real.watch.mockReturnValue(stop);
    await store.load(PREVIEW_RECEIPT_TOKEN, 'demo', 'la-bahia');
    const receipt = projectReceipt(previewReceipt());
    real.receipt.mockReturnValue(
      of({
        ...receipt,
        checkIn: 'CHECKED_IN',
        reservation: { ...receipt.reservation, status: 'ACTIVE' },
      }),
    );
    const notify = real.watch.mock.calls[0]![1] as () => void;
    notify();
    await Promise.resolve();
    expect(store.receipt()?.checkIn).toBe('CHECKED_IN');
    TestBed.resetTestingModule();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('rechaza pendiente, cancelado, revocado y token discordante', async () => {
    const receipt = previewReceipt();
    for (const invalid of [
      { ...receipt, payment: { ...receipt.payment, status: 'PENDING' } },
      { ...receipt, payment: { ...receipt.payment, status: 'CANCELLED' } },
      { ...receipt, reservation: { ...receipt.reservation, status: 'CANCELLED' } },
      { ...receipt, revoked: true },
      { ...receipt, token: 'different' },
    ]) {
      api.receipt.mockReturnValue(of(invalid));
      await store.load(PREVIEW_RECEIPT_TOKEN);
      expect(store.pageStatus()).toBe('not-found');
      expect(store.receipt()).toBeNull();
    }
  });

  it('cancela consulta del token anterior y no expone su resultado', async () => {
    const pending = new Subject<ReturnType<typeof previewReceipt>>();
    api.receipt.mockReturnValueOnce(pending);
    const old = store.load('old');
    await store.load(PREVIEW_RECEIPT_TOKEN);
    expect(pending.observed).toBe(false);
    pending.next({ ...previewReceipt(), token: 'old' });
    await old;
    expect(store.receipt()?.token).toBe(PREVIEW_RECEIPT_TOKEN);
  });
});
