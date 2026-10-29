import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AuthSession, type SessionUser } from '@mapit/auth';
import {
  PREVIEW_ESTABLISHMENT_ID,
  PREVIEW_RECEIPT_TOKEN,
  CheckInsService,
  projectReceipt,
  previewReceipt,
} from '@mapit/api-client';
import { of, throwError } from 'rxjs';
import { RuntimeConfigStore, type RuntimeConfig } from '../../../core/runtime-config';
import { CheckInApi, CheckInError, type CheckInScenario } from './check-in-api';

export const DEMO_OPERATOR: SessionUser = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: 'demo',
  email: 'staff@example.test',
  fullName: 'Operador de prueba',
  role: 'ADMIN',
};
const CONFIG: RuntimeConfig = {
  apiBaseUrl: 'http://localhost:8080/api/v1',
  wsUrl: '',
  unleashProxyUrl: '',
  unleashClientKey: '',
  environment: 'test',
  paymentPreviewEnabled: true,
};

describe('CheckInApi (solo fixture)', () => {
  const user = signal<SessionUser | null>(DEMO_OPERATOR);
  const config = signal<RuntimeConfig>(CONFIG);
  let api: CheckInApi;
  const realLookup = vi.fn(() => of({ receipt: projectReceipt(previewReceipt()), audit: null }));

  beforeEach(() => {
    vi.useFakeTimers();
    realLookup.mockReset();
    realLookup.mockReturnValue(of({ receipt: projectReceipt(previewReceipt()), audit: null }));
    user.set(DEMO_OPERATOR);
    config.set(CONFIG);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: { user } },
        { provide: RuntimeConfigStore, useValue: { config } },
        {
          provide: CheckInsService,
          useValue: { lookupCheckIn: realLookup, registerCheckIn: realLookup },
        },
      ],
    });
    api = TestBed.inject(CheckInApi);
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    [0, 'request'],
    [500, 'request'],
    [503, 'request'],
    [400, 'invalid'],
    [401, 'forbidden'],
    [403, 'forbidden'],
    [404, 'invalid'],
    [409, 'conflict'],
    [410, 'expired'],
  ])(
    'clasifica HTTP %s sin confundir fallos técnicos con llegada inválida',
    async (status, code) => {
      config.set({ ...CONFIG, paymentPreviewEnabled: false });
      realLookup.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: Number(status) })),
      );
      await expect(
        api.arrive(PREVIEW_RECEIPT_TOKEN, PREVIEW_ESTABLISHMENT_ID),
      ).rejects.toMatchObject({ code });
    },
  );

  it('un error interno no se convierte en pago pendiente por el tipo de Problem', async () => {
    config.set({ ...CONFIG, paymentPreviewEnabled: false });
    realLookup.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: { type: 'https://mapit.dev/problems/payment-internal' },
          }),
      ),
    );
    await expect(api.lookup(PREVIEW_RECEIPT_TOKEN, PREVIEW_ESTABLISHMENT_ID)).rejects.toMatchObject(
      { code: 'request' },
    );
  });

  it('no ofrece preview por defecto ni en producción, aunque se habilite el flag', async () => {
    config.set({ ...CONFIG, paymentPreviewEnabled: false });
    expect(api.preview()).toBe(false);
    await api.lookup(PREVIEW_RECEIPT_TOKEN, PREVIEW_ESTABLISHMENT_ID);
    expect(realLookup).toHaveBeenCalled();
    config.set({ ...CONFIG, environment: 'production' });
    expect(api.preview()).toBe(false);
    expect(() => api.setScenario('ready')).toThrow(CheckInError);
  });

  it('rechaza otro tenant, un rol no permitido y un establecimiento diferente', async () => {
    user.set({ ...DEMO_OPERATOR, tenantId: 'otro-tenant' });
    await expect(api.lookup(PREVIEW_RECEIPT_TOKEN, PREVIEW_ESTABLISHMENT_ID)).rejects.toMatchObject(
      { code: 'forbidden' },
    );
    user.set({ ...DEMO_OPERATOR, role: 'MANAGER' });
    await expect(api.lookup(PREVIEW_RECEIPT_TOKEN, PREVIEW_ESTABLISHMENT_ID)).rejects.toMatchObject(
      { code: 'forbidden' },
    );
    user.set(DEMO_OPERATOR);
    await expect(api.lookup(PREVIEW_RECEIPT_TOKEN, 'otro')).rejects.toMatchObject({
      code: 'wrongVenue',
    });
    await expect(api.lookup('x'.repeat(43), PREVIEW_ESTABLISHMENT_ID)).rejects.toMatchObject({
      code: 'invalid',
    });
  });

  it('consultar no activa la reserva ni ocupa espacios', async () => {
    const request = api.lookup(PREVIEW_RECEIPT_TOKEN, PREVIEW_ESTABLISHMENT_ID);
    await vi.advanceTimersByTimeAsync(160);
    const result = await request;
    expect(result.receipt.reservation.status).toBe('CONFIRMED');
    expect(result.receipt.reservation.spaces.every((space) => space.state === 'RESERVED')).toBe(
      true,
    );
    expect(result.receipt.checkIn).toBe('NOT_CHECKED_IN');
    expect(result.audit).toBeNull();
  });

  it('dos llegadas concurrentes comparten un único resultado y registro de prueba', async () => {
    const first = api.arrive(PREVIEW_RECEIPT_TOKEN, PREVIEW_ESTABLISHMENT_ID);
    const duplicate = api.arrive(PREVIEW_RECEIPT_TOKEN, PREVIEW_ESTABLISHMENT_ID);
    await vi.advanceTimersByTimeAsync(160);
    const a = await first;
    const b = await duplicate;
    expect(a.audit).toBe(b.audit);
    expect(a.receipt.checkIn).toBe('CHECKED_IN');
    expect(a.receipt.reservation.status).toBe('ACTIVE');
    expect(a.receipt.reservation.spaces.every((space) => space.state === 'OCCUPIED')).toBe(true);
    expect(a.audit?.spaceIds).toHaveLength(2);
    expect(a.audit?.actorId).toBe(DEMO_OPERATOR.id);
  });

  it.each<CheckInScenario>([
    'invalid',
    'expired',
    'revoked',
    'cancelled',
    'pending',
    'window',
    'wrongVenue',
  ])('bloquea llegada en escenario %s', async (scenario) => {
    api.setScenario(scenario);
    const request = api.arrive(PREVIEW_RECEIPT_TOKEN, PREVIEW_ESTABLISHMENT_ID);
    const expectation = expect(request).rejects.toMatchObject({ code: scenario });
    await vi.advanceTimersByTimeAsync(160);
    await expectation;
  });

  it('revalida la sesión antes de cualquier cambio después de una espera', async () => {
    const request = api.arrive(PREVIEW_RECEIPT_TOKEN, PREVIEW_ESTABLISHMENT_ID);
    const expectation = expect(request).rejects.toMatchObject({ code: 'forbidden' });
    user.set({ ...DEMO_OPERATOR, tenantId: 'otro-tenant' });
    await vi.advanceTimersByTimeAsync(160);
    await expectation;
    user.set(DEMO_OPERATOR);
    const lookup = api.lookup(PREVIEW_RECEIPT_TOKEN, PREVIEW_ESTABLISHMENT_ID);
    await vi.advanceTimersByTimeAsync(160);
    expect((await lookup).receipt.checkIn).toBe('NOT_CHECKED_IN');
  });
});
