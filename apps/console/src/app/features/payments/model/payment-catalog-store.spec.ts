import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  PaymentsService,
  type MerchantPaymentMethod,
  type PaymentMethodWrite,
} from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { of, Subject, throwError } from 'rxjs';

import { EstablishmentContext } from '../../../core/establishment-context';
import { RuntimeConfigStore } from '../../../core/runtime-config';
import { STRINGS } from '../../../core/strings';
import { PaymentCatalogStore } from './payment-catalog-store';

const PNG = 'data:image/png;base64,iVBORw0KGgoA';
const DRAFT = {
  displayName: 'QR Centro',
  country: 'BO',
  currency: 'BOB',
  bankName: 'Banco',
  accountHolderName: 'Titular',
  accountReference: 'centro',
};
const BANK_QR: MerchantPaymentMethod = {
  ...DRAFT,
  id: 'method-1',
  establishmentId: 'venue-1',
  provider: 'STATIC_BANK_QR',
  verification: 'MANUAL',
  enabled: true,
  staticQrImage: PNG,
  createdAt: '2026-11-04T00:00:00Z',
  updatedAt: '2026-11-04T00:00:00Z',
};

describe('PaymentCatalogStore', () => {
  const user = signal({ role: 'ADMIN' });
  const active = signal<{ id: string; canManagePayments: boolean } | null>(null);
  const api = {
    listPaymentMethods: vi.fn(),
    createPaymentMethod: vi.fn(),
    updatePaymentMethod: vi.fn(),
  };
  let store: PaymentCatalogStore;

  beforeEach(() => {
    vi.resetAllMocks();
    user.set({ role: 'ADMIN' });
    active.set({ id: 'venue-1', canManagePayments: true });
    api.listPaymentMethods.mockReturnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        PaymentCatalogStore,
        { provide: PaymentsService, useValue: api },
        { provide: AuthSession, useValue: { user } },
        { provide: EstablishmentContext, useValue: { active, status: () => 'ready' } },
        {
          provide: RuntimeConfigStore,
          useValue: { config: () => ({ environment: 'production' }) },
        },
      ],
    });
    store = TestBed.inject(PaymentCatalogStore);
  });

  async function fillQr(): Promise<void> {
    store.start('STATIC_BANK_QR');
    store.patch(DRAFT);
    const pngBytes = Uint8Array.from(atob(PNG.split(',')[1]!), (char) => char.charCodeAt(0));
    await store.uploadQr(new File([pngBytes], 'bank.png', { type: 'image/png' }));
  }

  it('ignores old lists and draft changes on context switch', async () => {
    const oldRequest = new Subject<MerchantPaymentMethod[]>();
    const newRequest = new Subject<MerchantPaymentMethod[]>();
    api.listPaymentMethods.mockReturnValueOnce(oldRequest).mockReturnValueOnce(newRequest);
    TestBed.tick();
    store.start('STATIC_BANK_QR');
    store.patch({ displayName: 'Old draft' });
    expect(store.dirty()).toBe(true);

    active.set({ id: 'venue-2', canManagePayments: true });
    expect(store.draft()).toBeNull();
    expect(store.dirty()).toBe(false);
    expect(await store.save()).toBeNull();
    TestBed.tick();
    expect(api.listPaymentMethods.mock.calls).toEqual([
      [{ establishmentId: 'venue-1' }],
      [{ establishmentId: 'venue-2' }],
    ]);

    const newMethod = { ...BANK_QR, id: 'method-2', establishmentId: 'venue-2' };
    newRequest.next([newMethod]);
    oldRequest.next([BANK_QR]);
    await vi.waitFor(() => expect(store.methods()).toEqual([newMethod]));
    expect(store.loading()).toBe(false);
  });

  it('rejects writes without context or permission', async () => {
    active.set(null);
    TestBed.tick();
    store.start('STATIC_BANK_QR');
    expect(store.canManage()).toBe(false);
    expect(await store.save()).toBeNull();

    active.set({ id: 'venue-1', canManagePayments: true });
    user.set({ role: 'MANAGER' });
    TestBed.tick();
    expect(api.listPaymentMethods).not.toHaveBeenCalled();
    expect(api.createPaymentMethod).not.toHaveBeenCalled();
  });

  it('requires the QR and refuses disguised or oversized images', async () => {
    store.start('STATIC_BANK_QR');
    store.patch(DRAFT);
    await store.uploadQr(new File(['fake'], 'bank.png', { type: 'image/png' }));
    expect(store.qrError()).toBe('format');
    expect(store.canSave()).toBe(false);

    await store.uploadQr(new File([new Uint8Array(262_500)], 'large.jpg', { type: 'image/jpeg' }));
    expect(store.qrError()).toBe('size');
    expect(await store.save()).toBeNull();
    expect(api.createPaymentMethod).not.toHaveBeenCalled();
  });

  it('prevents duplicate saves and confirms the status returned by the server', async () => {
    const pending = new Subject<MerchantPaymentMethod>();
    api.createPaymentMethod.mockReturnValue(pending);
    await fillQr();
    expect(store.canSave()).toBe(true);
    const first = store.save();
    expect(await store.save()).toBeNull();
    expect(api.createPaymentMethod).toHaveBeenCalledTimes(1);
    expect(api.createPaymentMethod).toHaveBeenCalledWith({
      paymentMethodWrite: {
        ...DRAFT,
        establishmentId: 'venue-1',
        provider: 'STATIC_BANK_QR',
        enabled: true,
        staticQrImage: PNG,
      },
    });

    const saved = { ...BANK_QR, enabled: false };
    pending.next(saved);
    expect(await first).toEqual(saved);
    expect(store.dirty()).toBe(false);
  });

  it('does not confirm a save that finished after switching venue', async () => {
    const pending = new Subject<MerchantPaymentMethod>();
    api.createPaymentMethod.mockReturnValue(pending);
    await fillQr();
    const save = store.save();

    active.set({ id: 'venue-2', canManagePayments: true });
    TestBed.tick();
    expect(store.draft()).toBeNull();
    expect(store.busy()).toBe(true);
    pending.next(BANK_QR);
    expect(await save).toBeNull();
    expect(store.busy()).toBe(false);
    expect(store.methods()).toEqual([]);
  });

  it('lists inherited methods read-only and keeps the draft after a conflict', async () => {
    const inherited = { ...BANK_QR, establishmentId: null };
    api.listPaymentMethods.mockReturnValueOnce(of([inherited]));
    TestBed.tick();
    await vi.waitFor(() => expect(store.methods()).toEqual([inherited]));
    store.edit(inherited);
    await store.toggle(inherited);
    expect(store.canEdit(inherited)).toBe(false);
    expect(store.draft()).toBeNull();
    expect(api.updatePaymentMethod).not.toHaveBeenCalled();

    api.listPaymentMethods.mockReturnValueOnce(of([BANK_QR]));
    await store.load();
    api.updatePaymentMethod.mockReturnValue(throwError(() => ({ status: 409 })));
    store.edit(BANK_QR);
    store.patch({ accountReference: 'otra' });
    expect(await store.save()).toBeNull();
    expect(store.saveError()).toBe(STRINGS.paymentMethods.catalogConflict);
    expect(store.draft()?.accountReference).toBe('otra');
  });

  it('registers the integrated gateway as inactive through the existing API', async () => {
    api.createPaymentMethod.mockImplementation(
      ({ paymentMethodWrite }: { paymentMethodWrite: PaymentMethodWrite }) =>
        of({ ...BANK_QR, ...paymentMethodWrite }),
    );
    store.start('INTEGRATED_GATEWAY');
    store.patch({ ...DRAFT, enabled: true });
    const saved = await store.save();
    expect(saved?.provider).toBe('INTEGRATED_GATEWAY');
    expect(saved?.enabled).toBe(false);
    expect(saved?.staticQrImage).toBeNull();
  });

  it('uses the update response for edits and status changes', async () => {
    api.listPaymentMethods.mockReturnValueOnce(of([BANK_QR]));
    TestBed.tick();
    await vi.waitFor(() => expect(store.methods()).toEqual([BANK_QR]));
    api.updatePaymentMethod.mockImplementation(
      ({ paymentMethodWrite }: { paymentMethodWrite: PaymentMethodWrite }) =>
        of({ ...BANK_QR, ...paymentMethodWrite }),
    );

    store.edit(BANK_QR);
    store.patch({ displayName: 'Nombre descartado' });
    store.cancel();
    expect(store.dirty()).toBe(false);
    expect(store.draft()).toBeNull();

    store.edit(BANK_QR);
    store.patch({ displayName: 'Cobro Centro' });
    const edited = await store.save();
    expect(edited?.displayName).toBe('Cobro Centro');
    expect(store.methods()).toEqual([edited]);
    await store.toggle(BANK_QR);
    expect(store.methods()[0]?.displayName).toBe('Cobro Centro');
    expect(store.methods()[0]?.enabled).toBe(false);
    expect(api.createPaymentMethod).not.toHaveBeenCalled();
    TestBed.tick();
    expect(api.listPaymentMethods).toHaveBeenCalledTimes(1);
  });
});
