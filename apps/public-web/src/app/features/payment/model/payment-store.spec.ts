import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import {
  PREVIEW_CHECKOUT_PATH,
  PREVIEW_RECEIPT_PATH,
  previewPayment,
  previewReservation,
  projectCheckout,
  projectReceipt,
  previewReceipt,
} from '@mapit/api-client';
import { Subject, of, throwError } from 'rxjs';

import { STRINGS } from '../../../core/strings';
import { ReservationAccess } from '../../../core/reservation-access';
import { PublicRuntimeConfig } from '../../../core/runtime-config';
import {
  PaymentPreviewApi,
  PaymentPreviewError,
  type CheckoutPreview,
} from '../data/payment-preview-api';
import { PaymentStore } from './payment-store';
import { PublicPaymentApi } from '../data/public-payment-api';

describe('PaymentStore', () => {
  const reservation = previewReservation();
  const scope = {
    tenantSlug: reservation.tenantSlug,
    establishmentSlug: reservation.establishmentSlug,
    reservationId: reservation.id,
  };
  let api: { allowed: ReturnType<typeof vi.fn>; checkout: ReturnType<typeof vi.fn> };
  let previewAllowed: ReturnType<typeof signal<boolean>>;
  let store: PaymentStore;
  let real: {
    checkout: ReturnType<typeof vi.fn>;
    watch: ReturnType<typeof vi.fn>;
    issueReceipt: ReturnType<typeof vi.fn>;
    simulationAllowed: ReturnType<typeof vi.fn>;
  };
  const response = (status: Parameters<typeof previewPayment>[0] = 'PENDING'): CheckoutPreview => ({
    reservation,
    payment: previewPayment(status),
    methods: [
      {
        id: 'demo-mock',
        name: 'Mock',
        provider: 'MOCK_GATEWAY',
        verification: 'AUTOMATIC',
        staticQrImage: null,
      },
      {
        id: 'demo-static',
        name: 'Static',
        provider: 'STATIC_BANK_QR',
        verification: 'MANUAL',
        staticQrImage: null,
      },
    ],
  });

  beforeEach(() => {
    previewAllowed = signal(true);
    real = {
      checkout: vi.fn(() => of(projectCheckout(response()))),
      watch: vi.fn(() => () => undefined),
      issueReceipt: vi.fn(() => of(projectReceipt(previewReceipt()))),
      simulationAllowed: vi.fn(() => true),
    };
    api = {
      allowed: vi.fn(() => previewAllowed()),
      checkout: vi.fn((_scope: unknown, status: Parameters<typeof previewPayment>[0]) =>
        of(response(status)),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        PaymentStore,
        { provide: PaymentPreviewApi, useValue: api },
        { provide: PublicPaymentApi, useValue: real },
        {
          provide: PublicRuntimeConfig,
          useValue: {
            config: () => ({
              environment: 'development',
              paymentPublicOrigin: 'http://localhost:4500',
            }),
          },
        },
      ],
    });
    store = TestBed.inject(PaymentStore);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('muestra pendiente sin comprobante y solo permite comprobante confirmado', async () => {
    await store.load(scope);
    expect(store.payment()?.paidAmount).toBe('0.00');
    expect(store.receiptPath()).toBeNull();
    await store.load(scope, 'CONFIRMED');
    expect(store.receiptPath()).toBe(PREVIEW_RECEIPT_PATH);
    expect(store.deposit()).toContain('120');
    expect(PREVIEW_CHECKOUT_PATH).toContain(scope.reservationId);
  });

  it('consulta backend real por defecto sin usar fixtures cuando preview está deshabilitado', async () => {
    previewAllowed.set(false);
    await store.load(scope);
    expect(store.pageStatus()).toBe('loaded');
    expect(api.checkout).not.toHaveBeenCalled();
    expect(real.checkout).toHaveBeenCalledWith(scope);
  });

  it('reutiliza clave ante fallo de red y genera otra tras intento fallido persistido', async () => {
    api.allowed.mockReturnValue(false);
    const initial = { ...projectCheckout(response()), payment: null };
    real.checkout.mockReturnValue(of(initial));
    const start = vi.fn<PublicPaymentApi['start']>(() => throwError(() => new Error('offline')));
    Object.assign(real, { start });
    await store.load(scope);
    await store.startPayment();
    await store.startPayment();
    expect(start).toHaveBeenCalledTimes(2);
    expect(start.mock.calls[0]?.[2]).toBe(start.mock.calls[1]?.[2]);
    real.checkout.mockReturnValue(of(projectCheckout(response('FAILED'))));
    await store.reconnect();
    await store.startPayment();
    expect(start).toHaveBeenCalledTimes(3);
    expect(start.mock.calls[2]?.[2]).not.toBe(start.mock.calls[0]?.[2]);
  });

  it('permite reintentar CANCELLED solo cuando el servidor lo habilita', async () => {
    previewAllowed.set(false);
    const initial = { ...projectCheckout(response()), payment: null };
    real.checkout.mockReturnValue(of(initial));
    const start = vi.fn<PublicPaymentApi['start']>(() => throwError(() => new Error('offline')));
    Object.assign(real, { start });
    await store.load(scope);
    await store.startPayment();
    real.checkout.mockReturnValue(
      of({ ...projectCheckout(response('CANCELLED')), available: false }),
    );
    await store.refresh();
    expect(store.canStart()).toBe(false);
    real.checkout.mockReturnValue(
      of({ ...projectCheckout(response('CANCELLED')), available: true }),
    );
    await store.refresh();
    expect(store.canStart()).toBe(true);
    await store.startPayment();
    expect(start.mock.calls[1]?.[2]).not.toBe(start.mock.calls[0]?.[2]);
    await store.refresh();
    await store.startPayment();
    expect(start.mock.calls[2]?.[2]).toBe(start.mock.calls[1]?.[2]);
  });

  it('actualiza por HTTP desconectado y bloquea solo actualizaciones simultáneas', async () => {
    previewAllowed.set(false);
    await store.load(scope);
    const response$ = new Subject<ReturnType<typeof projectCheckout>>();
    real.checkout.mockReturnValue(response$);
    const first = store.reconnect();
    expect(store.refreshing()).toBe(true);
    await store.reconnect();
    expect(real.checkout).toHaveBeenCalledTimes(2);
    response$.next(projectCheckout(response('CANCELLED')));
    response$.complete();
    await first;
    expect(store.refreshing()).toBe(false);
    expect(store.payment()?.status).toBe('CANCELLED');
  });

  it('cierra el checkout si la credencial caduca durante el refresco, sin mostrar datos ni recibo anteriores', async () => {
    previewAllowed.set(false);
    real.checkout.mockReturnValue(of(projectCheckout(response('CONFIRMED'))));
    await store.load(scope);
    real.checkout.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 410 })));
    await store.refresh();
    expect(store.pageStatus()).toBe('not-found');
    expect(store.data()).toBeNull();
    expect(store.receiptPath()).toBeNull();
  });

  it('no acepta un refresco HTTP que devuelve otra reserva', async () => {
    previewAllowed.set(false);
    await store.load(scope);
    const other = projectCheckout(response());
    real.checkout.mockReturnValue(
      of({ ...other, reservation: { ...other.reservation, id: 'other' } }),
    );
    await store.refresh();
    expect(store.pageStatus()).toBe('not-found');
    expect(store.data()).toBeNull();
  });

  it('emite comprobante con carga, evita duplicados y permite reintentar un error', async () => {
    previewAllowed.set(false);
    const pending = new Subject<ReturnType<typeof projectReceipt>>();
    real.checkout.mockReturnValue(of(projectCheckout(response('CONFIRMED'))));
    real.issueReceipt.mockReturnValue(pending);
    await store.load(scope);
    expect(store.receiptStatus()).toBe('loading');
    expect(store.receiptPath()).toBeNull();
    await store.issueReceipt();
    expect(real.issueReceipt).toHaveBeenCalledOnce();
    pending.error(new Error('offline'));
    await Promise.resolve();
    expect(store.receiptStatus()).toBe('error');
    real.issueReceipt.mockReturnValue(of(projectReceipt(previewReceipt())));
    await store.issueReceipt();
    expect(store.receiptStatus()).toBe('loaded');
    expect(store.receiptPath()).toBe(PREVIEW_RECEIPT_PATH);
  });

  it('no pierde una notificación STOMP recibida durante otra consulta HTTP', async () => {
    previewAllowed.set(false);
    await store.load(scope);
    const pending = new Subject<ReturnType<typeof projectCheckout>>();
    real.checkout
      .mockReturnValueOnce(pending)
      .mockReturnValue(of(projectCheckout(response('CANCELLED'))));
    const first = store.refresh();
    const notify = real.watch.mock.calls[0]![1] as () => void;
    notify();
    pending.next(projectCheckout(response()));
    pending.complete();
    await first;
    await Promise.resolve();
    expect(real.checkout).toHaveBeenCalledTimes(3);
    expect(store.payment()?.status).toBe('CANCELLED');
  });

  it('un comprobante inválido permite reintentar sin publicar su enlace', async () => {
    previewAllowed.set(false);
    real.checkout.mockReturnValue(of(projectCheckout(response('CONFIRMED'))));
    real.issueReceipt.mockReturnValue(
      of({ ...projectReceipt(previewReceipt()), token: 'invalido' }),
    );
    await store.load(scope);
    await Promise.resolve();
    expect(store.receiptStatus()).toBe('error');
    expect(store.receiptPath()).toBeNull();
    real.issueReceipt.mockReturnValue(of(projectReceipt(previewReceipt())));
    await store.issueReceipt();
    expect(store.receiptStatus()).toBe('loaded');
  });

  it('descarta la emisión del comprobante de un ámbito anterior', async () => {
    previewAllowed.set(false);
    const pending = new Subject<ReturnType<typeof projectReceipt>>();
    real.checkout.mockReturnValueOnce(of(projectCheckout(response('CONFIRMED'))));
    real.issueReceipt.mockReturnValue(pending);
    await store.load(scope);
    await store.load(scope);
    pending.next(projectReceipt(previewReceipt()));
    pending.complete();
    await Promise.resolve();
    expect(store.receiptStatus()).toBe('idle');
    expect(store.receiptPath()).toBeNull();
  });

  it.each(['resolve', 'reject'] as const)(
    'ignora %s tardío del comprobante si un GET invalidó la reserva del mismo pago',
    async (outcome) => {
      previewAllowed.set(false);
      const checkout = projectCheckout(response('CONFIRMED'));
      const pending = new Subject<ReturnType<typeof projectReceipt>>();
      real.checkout.mockReturnValue(of(checkout));
      real.issueReceipt.mockReturnValue(pending);
      await store.load(scope);
      expect(store.receiptStatus()).toBe('loading');

      real.checkout.mockReturnValue(
        of({ ...checkout, reservation: { ...checkout.reservation, status: 'CANCELLED' } }),
      );
      await store.refresh();
      expect(store.payment()?.status).toBe('CONFIRMED');
      expect(store.receiptStatus()).toBe('idle');
      expect(store.receiptPath()).toBeNull();

      if (outcome === 'resolve') {
        pending.next(projectReceipt(previewReceipt()));
        pending.complete();
      } else {
        pending.error(new Error('offline'));
      }
      await Promise.resolve();
      expect(store.receiptPath()).toBeNull();
      expect(store.receiptStatus()).toBe('idle');
      expect(store.actionError()).toBeNull();
    },
  );

  it('conserva error sin fallback financiero ni datos anteriores', async () => {
    await store.load(scope);
    api.checkout.mockReturnValue(throwError(() => new Error('offline')));
    await store.load(scope);
    expect(store.pageStatus()).toBe('error');
    expect(store.data()).toBeNull();
    api.checkout.mockReturnValue(throwError(() => new PaymentPreviewError('not-found')));
    await store.load({ ...scope, tenantSlug: 'other' });
    expect(store.pageStatus()).toBe('not-found');
  });

  it('preserva el método estático al simular su verificación manual', async () => {
    await store.load(scope);
    store.chooseMethod('demo-static');
    expect(store.payment()?.status).toBe('PENDING_MANUAL_VERIFICATION');
    expect(store.receiptPath()).toBeNull();
    store.simulateConfirmation();
    await Promise.resolve();
    expect(store.selectedMethod()?.provider).toBe('STATIC_BANK_QR');
    expect(store.selectedMethod()?.verification).toBe('MANUAL');
    expect(store.payment()?.status).toBe('CONFIRMED');
  });

  it('expone el enlace del intento solo para MOCK pendiente con simulación permitida', async () => {
    api.allowed.mockReturnValue(false);
    TestBed.inject(ReservationAccess).save(scope, 'a'.repeat(43), null);
    const checkout = projectCheckout(response());
    const withPath = {
      ...checkout,
      available: false,
      unavailableReason: 'PAYMENT_PENDING',
      payment: { ...checkout.payment!, id: '20000000-0000-0000-0000-000000000002' },
      methods: checkout.methods.filter((method) => method.provider !== 'MOCK_GATEWAY'),
      historicalMethod: {
        id: 'historical-mock',
        displayName: 'Pasarela de prueba',
        provider: 'MOCK_GATEWAY',
        verification: 'AUTOMATIC',
        staticQrImage: null,
        simulationPath: '/simulacion/qr/30000000-0000-0000-0000-000000000003',
      },
    };
    real.checkout.mockReturnValue(of(withPath));
    await store.load(scope);
    const link = store.simulationLink();
    expect(link).toMatch(
      /^http:\/\/localhost:4500\/simulacion\/qr\/30000000-0000-0000-0000-000000000003\?/,
    );
    expect(link).toContain('pago=20000000-0000-0000-0000-000000000002');
    expect(link).toContain('#access=' + 'a'.repeat(43));
    expect(link).not.toContain('?access=');
    real.simulationAllowed.mockReturnValue(false);
    await store.load(scope);
    expect(store.simulationLink()).toBeNull();
  });

  it('en preview no hay enlace de intento ni método histórico y el cobro real inicia igual', async () => {
    await store.load(scope);
    expect(store.simulationLink()).toBeNull();
    expect(store.historicalAttempt()).toBeNull();
    expect(store.canStart()).toBe(false);
    previewAllowed.set(false);
    real.checkout.mockReturnValue(
      of({
        ...projectCheckout(response()),
        payment: null,
        historicalMethod: null,
      }),
    );
    await store.load(scope);
    expect(store.simulationLink()).toBeNull();
    expect(store.canStart()).toBe(true);
  });

  it('muestra el método histórico de un intento no iniciable sin habilitar cobros', async () => {
    api.allowed.mockReturnValue(false);
    const checkout = projectCheckout(response('CONFIRMED'));
    real.checkout.mockReturnValue(
      of({
        ...checkout,
        methods: checkout.methods.filter((method) => method.provider !== 'MOCK_GATEWAY'),
        historicalMethod: {
          id: 'old-mock',
          displayName: 'Pasarela anterior',
          provider: 'MOCK_GATEWAY',
          verification: 'AUTOMATIC',
          staticQrImage: null,
          simulationPath: null,
        },
      }),
    );
    await store.load(scope);
    expect(store.historicalAttempt()?.displayName).toBe('Pasarela anterior');
    expect(store.canChooseMethod()).toBe(false);
    expect(store.canStart()).toBe(false);
  });

  it('bloquea nuevos cobros y explica PAYMENT_PENDING', async () => {
    api.allowed.mockReturnValue(false);
    const checkout = projectCheckout(response());
    real.checkout.mockReturnValue(
      of({
        ...checkout,
        available: false,
        unavailableReason: 'PAYMENT_PENDING',
        methods: [],
        historicalMethod: {
          id: 'pending-mock',
          displayName: 'Pasarela de prueba',
          provider: 'MOCK_GATEWAY',
          verification: 'AUTOMATIC',
          staticQrImage: null,
          simulationPath: '/simulacion/qr/30000000-0000-0000-0000-000000000003',
        },
      }),
    );
    await store.load(scope);
    expect(store.canStart()).toBe(false);
    expect(store.unavailableMessage()).toBe(STRINGS.payment.unavailableReasons.PAYMENT_PENDING);
  });

  it('cancela respuestas previas y destrucción sin restaurar datos obsoletos', async () => {
    const pending = new Subject<CheckoutPreview>();
    api.checkout.mockReturnValueOnce(pending);
    const old = store.load(scope);
    await store.load(scope, 'FAILED');
    expect(pending.observed).toBe(false);
    pending.next(response('CONFIRMED'));
    await old;
    expect(store.payment()?.status).toBe('FAILED');
    const late = new Subject<CheckoutPreview>();
    api.checkout.mockReturnValueOnce(late);
    const destroyed = store.load(scope);
    TestBed.resetTestingModule();
    expect(late.observed).toBe(false);
    await destroyed;
    expect(store.data()).toBeNull();
  });

  it('recupera el estado al reconectar y rechaza escenarios desconocidos', async () => {
    vi.useFakeTimers();
    await store.load(scope, 'RECONCILIATION_REQUIRED');
    const reconnect = store.reconnect();
    expect(store.connection()).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(480);
    await reconnect;
    expect(store.payment()?.status).toBe('RECONCILIATION_REQUIRED');
    expect(store.connection()).toBe('connected');
    store.chooseScenario('INVENTED_STATUS');
    expect(store.scenario()).toBe('RECONCILIATION_REQUIRED');
  });

  it('una reconexión tardía no sobrescribe un método recién seleccionado', async () => {
    vi.useFakeTimers();
    await store.load(scope);
    const pending = new Subject<CheckoutPreview>();
    api.checkout.mockReturnValueOnce(pending);
    const reconnect = store.reconnect();
    await vi.advanceTimersByTimeAsync(480);
    store.chooseMethod('demo-static');
    expect(pending.observed).toBe(false);
    pending.next(response('CONFIRMED'));
    await reconnect;
    expect(store.payment()?.status).toBe('PENDING_MANUAL_VERIFICATION');
    expect(store.selectedMethod()?.provider).toBe('STATIC_BANK_QR');
  });
});
