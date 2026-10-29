import { TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter, ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';

import { STRINGS } from '../../../core/strings';
import { ReservationAccess } from '../../../core/reservation-access';
import { PublicPaymentApi } from '../data/public-payment-api';
import { SimulationPage } from './simulation-page';

describe('SimulationPage', () => {
  const capability = 'a'.repeat(43);
  const token = '30000000-0000-0000-0000-000000000003';
  const paymentId = '20000000-0000-0000-0000-000000000002';
  const scope = {
    tenantSlug: 'tenant-a',
    establishmentSlug: 'venue-a',
    reservationId: '10000000-0000-0000-0000-000000000001',
  };
  const query = convertToParamMap({
    tenant: scope.tenantSlug,
    establecimiento: scope.establishmentSlug,
    reserva: scope.reservationId,
    pago: paymentId,
  });
  const checkout = () => ({
    reservation: {
      ...scope,
      id: scope.reservationId,
      status: 'CREATED',
      establishmentName: 'Local de prueba',
      timezone: 'America/La_Paz',
      startsAt: '2030-01-01T19:00:00Z',
      endsAt: '2030-01-01T21:00:00Z',
      spaces: [],
    },
    available: false,
    unavailableReason: 'PAYMENT_PENDING',
    currency: 'BOB',
    amount: '120.00',
    totalAmount: '400.00',
    paidAmount: '0',
    balanceAmount: '400.00',
    methods: [],
    historicalMethod: {
      id: 'mock-method',
      displayName: 'Pasarela de prueba',
      provider: 'MOCK_GATEWAY',
      verification: 'AUTOMATIC',
      staticQrImage: null,
      simulationPath: '/simulacion/qr/' + token,
    },
    payment: {
      id: paymentId,
      status: 'PENDING',
      provider: 'MOCK_GATEWAY',
      amount: '120.00',
      currency: 'BOB',
      totalAmount: '400.00',
      paidAmount: '0',
      expiresAt: '2030-01-01T00:00:00Z',
      externalReference: 'attempt-reference',
    },
  });
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let fragment: BehaviorSubject<string | null>;
  let api: {
    simulationAllowed: ReturnType<typeof vi.fn>;
    checkout: ReturnType<typeof vi.fn>;
    simulate: ReturnType<typeof vi.fn>;
  };
  let fixture: ReturnType<typeof TestBed.createComponent<SimulationPage>>;

  beforeEach(() => {
    queryParams = new BehaviorSubject(query);
    fragment = new BehaviorSubject<string | null>('access=' + capability);
    api = {
      simulationAllowed: vi.fn(() => true),
      checkout: vi.fn(() => of(checkout())),
      simulate: vi.fn(() => of({ id: paymentId, status: 'CONFIRMED' })),
    };
    TestBed.configureTestingModule({
      imports: [SimulationPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParams.asObservable(),
            fragment: fragment.asObservable(),
          },
        },
        { provide: PublicPaymentApi, useValue: api },
      ],
    });
    fixture = TestBed.createComponent(SimulationPage);
    fixture.componentRef.setInput('token', token);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  const element = () => fixture.nativeElement as HTMLElement;
  const button = (testId: string): HTMLButtonElement | null =>
    element().querySelector('[data-testid="' + testId + '"]');

  it('recupera el intento real para mostrar las acciones y no simula al abrir', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button('simulate-confirm')).toBeTruthy();
    expect(button('simulate-cancel')).toBeTruthy();
    expect(button('simulate-fail')).toBeNull();
    expect(element().querySelectorAll('.attempt-actions button')).toHaveLength(2);
    expect(api.checkout).toHaveBeenCalledWith(scope);
    expect(api.simulate).not.toHaveBeenCalled();
    expect(element().textContent).toContain(paymentId);
    expect(TestBed.inject(ReservationAccess).read(scope)).toBe(capability);
  });

  it('confirmar envía CONFIRMED del intento exacto y muestra el resultado', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    api.checkout.mockReturnValue(
      of({
        ...checkout(),
        payment: { ...checkout().payment, status: 'CONFIRMED' },
        historicalMethod: null,
      }),
    );
    button('simulate-confirm')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.simulate).toHaveBeenCalledWith(scope, paymentId, 'CONFIRMED');
    expect(element().textContent).toContain(STRINGS.qrSimulation.attemptResult.CONFIRMED);
    expect(button('simulate-confirm')).toBeNull();
  });

  it('cancelar envía CANCELLED y reconsulta el resultado persistido', async () => {
    api.simulate.mockImplementation(() => {
      api.checkout.mockReturnValue(
        of({
          ...checkout(),
          payment: { ...checkout().payment, status: 'CANCELLED' },
          historicalMethod: null,
          unavailableReason: null,
        }),
      );
      return of({ id: paymentId, status: 'CANCELLED' });
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    button('simulate-cancel')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.simulate).toHaveBeenCalledWith(scope, paymentId, 'CANCELLED');
    expect(element().textContent).toContain(STRINGS.qrSimulation.attemptResult.CANCELLED);
  });

  it.each(['CONFIRMED', 'CANCELLED', 'FAILED', 'EXPIRED', 'RECONCILIATION_REQUIRED'])(
    'recupera %s del mismo intento sin acciones ni POST',
    async (status) => {
      api.checkout.mockReturnValue(
        of({
          ...checkout(),
          payment: { ...checkout().payment, status },
          historicalMethod: null,
          unavailableReason: null,
        }),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(element().textContent).toContain(
        status === 'CONFIRMED'
          ? STRINGS.payment.mockConfirmed
          : STRINGS.payment.scenarios[status as keyof typeof STRINGS.payment.scenarios],
      );
      expect(element().textContent).toContain('Local de prueba');
      expect(element().textContent).toContain('120');
      expect(button('simulate-confirm')).toBeNull();
      expect(api.simulate).not.toHaveBeenCalled();
    },
  );

  it('descarta el POST tardío al cambiar el contexto del intento', async () => {
    const response = new Subject<{ id: string; status: string }>();
    api.simulate.mockReturnValue(response);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    button('simulate-confirm')!.click();
    fragment.next('access=invalido');
    fixture.detectChanges();
    response.next({ id: paymentId, status: 'CONFIRMED' });
    response.complete();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element().textContent).not.toContain(STRINGS.qrSimulation.attemptResult.CONFIRMED);
    expect(element().textContent).toContain(STRINGS.qrSimulation.invalid);
  });

  it('un fallo de red muestra alerta sin resultado terminal', async () => {
    api.simulate.mockReturnValue(throwError(() => new Error('offline')));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    button('simulate-confirm')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.simulate).toHaveBeenCalledWith(scope, paymentId, 'CONFIRMED');
    expect(element().textContent).toContain(STRINGS.payment.actionError);
    expect(button('simulate-confirm')).toBeTruthy();
  });

  it('no presenta éxito del POST si la consulta autoritativa sigue pendiente', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    button('simulate-confirm')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.checkout).toHaveBeenCalledTimes(2);
    expect(element().textContent).not.toContain(STRINGS.qrSimulation.attemptResult.CONFIRMED);
    expect(button('simulate-confirm')).toBeTruthy();
  });

  it('rechaza un terminal cuyo ID no coincide con el intento escaneado', async () => {
    api.checkout.mockReturnValue(
      of({
        ...checkout(),
        payment: {
          ...checkout().payment,
          id: '40000000-0000-0000-0000-000000000004',
          status: 'CONFIRMED',
        },
        historicalMethod: null,
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element().textContent).toContain(STRINGS.qrSimulation.invalid);
    expect(button('simulate-confirm')).toBeNull();
    expect(api.simulate).not.toHaveBeenCalled();
  });

  it('capability inválida no consulta checkout ni permite acciones', () => {
    fragment.next('access=corto');
    fixture.detectChanges();
    expect(element().textContent).toContain(STRINGS.qrSimulation.invalid);
    expect(api.checkout).not.toHaveBeenCalled();
    expect(api.simulate).not.toHaveBeenCalled();
    expect(button('simulate-confirm')).toBeNull();
  });

  it('rechaza un intento distinto al paymentId del QR', async () => {
    api.checkout.mockReturnValue(
      of({
        ...checkout(),
        payment: { ...checkout().payment, id: '40000000-0000-0000-0000-000000000004' },
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element().textContent).toContain(STRINGS.qrSimulation.invalid);
    expect(button('simulate-confirm')).toBeNull();
    expect(api.simulate).not.toHaveBeenCalled();
  });

  it('rechaza un scope de reserva discrepante', async () => {
    api.checkout.mockReturnValue(
      of({
        ...checkout(),
        reservation: { ...checkout().reservation, tenantSlug: 'tenant-b' },
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element().textContent).toContain(STRINGS.qrSimulation.invalid);
    expect(button('simulate-confirm')).toBeNull();
    expect(api.simulate).not.toHaveBeenCalled();
  });

  it('rechaza un método histórico con path distinto al QR', async () => {
    api.checkout.mockReturnValue(
      of({
        ...checkout(),
        historicalMethod: {
          ...checkout().historicalMethod,
          simulationPath: '/simulacion/qr/50000000-0000-0000-0000-000000000005',
        },
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element().textContent).toContain(STRINGS.qrSimulation.invalid);
    expect(button('simulate-confirm')).toBeNull();
    expect(api.simulate).not.toHaveBeenCalled();
  });

  it('sin opt-in recupera el intento pero no ofrece acciones', async () => {
    api.simulationAllowed.mockReturnValue(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element().textContent).toContain(STRINGS.qrSimulation.attemptIntro);
    expect(button('simulate-confirm')).toBeNull();
    expect(api.checkout).toHaveBeenCalledWith(scope);
    expect(api.simulate).not.toHaveBeenCalled();
  });

  it('un QR de configuración sin intento mantiene la pantalla informativa', () => {
    queryParams.next(convertToParamMap({}));
    fragment.next(null);
    fixture.detectChanges();
    expect(element().textContent).toContain(STRINGS.qrSimulation.tokenLabel);
    expect(button('simulate-confirm')).toBeNull();
    expect(api.checkout).not.toHaveBeenCalled();
    expect(api.simulate).not.toHaveBeenCalled();
  });
});
