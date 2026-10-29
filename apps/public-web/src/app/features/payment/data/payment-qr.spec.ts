import { PREVIEW_CHECKOUT_PATH, PREVIEW_RECEIPT_PATH } from '@mapit/api-client';

import { PaymentQr, attemptUrl, parseAttempt } from './payment-qr';

const { encode } = vi.hoisted(() => ({ encode: vi.fn<(...args: unknown[]) => Promise<string>>() }));
// Reproduce la forma CommonJS que Vite entrega en navegador.
vi.mock('qrcode', () => ({ default: { toDataURL: encode } }));

const CAPABILITY = 'a'.repeat(43);
const SIMULATION_TOKEN = '30000000-0000-0000-0000-000000000003';
const ATTEMPT = {
  tenantSlug: 'tenant-a',
  establishmentSlug: 'venue-a',
  reservationId: '10000000-0000-0000-0000-000000000001',
  paymentId: '20000000-0000-0000-0000-000000000002',
};

describe('PaymentQr', () => {
  beforeEach(() => {
    encode.mockReset();
    encode.mockResolvedValue('data:image/png;base64,test');
  });

  it('codifica URL MapIt exacta con zona blanca y raster estable', async () => {
    const qr = new PaymentQr();
    await expect(qr.render(PREVIEW_RECEIPT_PATH, 'https://public.example')).resolves.toBe(
      'data:image/png;base64,test',
    );
    expect(encode).toHaveBeenCalledWith(
      'https://public.example' + PREVIEW_RECEIPT_PATH,
      expect.objectContaining({ width: 256, margin: 3 }),
    );
    await qr.render(PREVIEW_CHECKOUT_PATH, 'http://localhost:4500');
    expect(encode).toHaveBeenLastCalledWith(
      'http://localhost:4500' + PREVIEW_CHECKOUT_PATH,
      expect.anything(),
    );
  });

  it('rechaza HTTP externo, rutas arbitrarias, datos bancarios y query de token', async () => {
    const qr = new PaymentQr();
    const invalidTargets: readonly (readonly [string, string])[] = [
      [PREVIEW_RECEIPT_PATH, 'http://public.example'],
      ['/comprobante/other', 'https://public.example'],
      [PREVIEW_RECEIPT_PATH + '?tenant=other', 'https://public.example'],
      ['https://external.example', 'https://public.example'],
      ['bank://pay/123', 'https://public.example'],
      [PREVIEW_RECEIPT_PATH, 'https://user:password@public.example'],
    ];
    for (const [path, origin] of invalidTargets)
      await expect(qr.render(path, origin)).rejects.toThrow();
    expect(encode).not.toHaveBeenCalled();
  });

  it('propaga fallo del generador sin sustituirlo por un QR falso', async () => {
    encode.mockRejectedValueOnce(new Error('encoder unavailable'));
    await expect(
      new PaymentQr().render(PREVIEW_RECEIPT_PATH, 'https://public.example'),
    ).rejects.toThrow('encoder unavailable');
  });

  it('construye el enlace del intento: scope y pago en query, capability solo en fragmento', () => {
    const url = attemptUrl(
      'https://public.example',
      '/simulacion/qr/' + SIMULATION_TOKEN,
      ATTEMPT,
      CAPABILITY,
    );
    const parsed = new URL(url!);
    expect(parsed.origin).toBe('https://public.example');
    expect(parsed.pathname).toBe('/simulacion/qr/' + SIMULATION_TOKEN);
    expect(parsed.searchParams.get('tenant')).toBe(ATTEMPT.tenantSlug);
    expect(parsed.searchParams.get('establecimiento')).toBe(ATTEMPT.establishmentSlug);
    expect(parsed.searchParams.get('reserva')).toBe(ATTEMPT.reservationId);
    expect(parsed.searchParams.get('pago')).toBe(ATTEMPT.paymentId);
    expect(parsed.searchParams.has('access')).toBe(false);
    expect(parsed.hash).toBe('#access=' + CAPABILITY);
    expect(parseAttempt(SIMULATION_TOKEN, parsed.searchParams, parsed.hash)).toEqual({
      ...ATTEMPT,
      capability: CAPABILITY,
    });
  });

  it('rechaza intentos con datos inválidos o capability fuera del fragmento', () => {
    const path = '/simulacion/qr/' + SIMULATION_TOKEN;
    expect(
      attemptUrl(
        'https://public.example',
        path,
        { ...ATTEMPT, paymentId: 'DEMO-PAY-0001' },
        CAPABILITY,
      ),
    ).toBeNull();
    expect(
      attemptUrl(
        'https://public.example',
        path,
        { ...ATTEMPT, tenantSlug: 'Tenant_A' },
        CAPABILITY,
      ),
    ).toBeNull();
    expect(attemptUrl('https://public.example', path, ATTEMPT, 'corto')).toBeNull();
    expect(attemptUrl('https://public.example', '/otra-ruta', ATTEMPT, CAPABILITY)).toBeNull();
    expect(attemptUrl('no-es-url', path, ATTEMPT, CAPABILITY)).toBeNull();

    const valid = new URL(attemptUrl('https://public.example', path, ATTEMPT, CAPABILITY)!);
    expect(parseAttempt(SIMULATION_TOKEN, valid.searchParams, null)).toBeNull();
    expect(parseAttempt('otro-token', valid.searchParams, valid.hash)).toBeNull();
    const withQueryAccess = new URL(valid.href);
    withQueryAccess.searchParams.append('access', CAPABILITY);
    expect(parseAttempt(SIMULATION_TOKEN, withQueryAccess.searchParams, '')).toBeNull();
    const tampered = new URL(valid.href);
    tampered.searchParams.set('pago', 'sin-uuid');
    expect(parseAttempt(SIMULATION_TOKEN, tampered.searchParams, valid.hash)).toBeNull();
  });

  it('renderAttempt codifica solo el destino exacto del intento', async () => {
    const qr = new PaymentQr();
    const url = attemptUrl(
      'http://localhost:4500',
      '/simulacion/qr/' + SIMULATION_TOKEN,
      ATTEMPT,
      CAPABILITY,
    )!;
    await expect(qr.renderAttempt(url)).resolves.toBe('data:image/png;base64,test');
    expect(encode).toHaveBeenLastCalledWith(url, expect.anything());
    await expect(
      qr.renderAttempt('https://public.example/simulacion/qr/' + SIMULATION_TOKEN),
    ).rejects.toThrow();
    await expect(qr.renderAttempt(url.replace('#access=' + CAPABILITY, ''))).rejects.toThrow();
    await expect(qr.renderAttempt(url + '&extra=1')).rejects.toThrow();
    expect(encode).toHaveBeenCalledTimes(1);
  });
});
