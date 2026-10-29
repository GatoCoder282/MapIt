import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  PREVIEW_ESTABLISHMENT_ID,
  PREVIEW_RECEIPT_TOKEN,
  previewReceipt,
  projectReceipt,
} from '@mapit/api-client';
import { CheckInApi, type CheckInResult } from '../data/check-in-api';
import { CheckInStore } from './check-in-store';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  return {
    promise: new Promise<T>((done) => {
      resolve = done;
    }),
    resolve: (value) => resolve(value),
  };
}
const RESULT: CheckInResult = {
  receipt: { ...projectReceipt(previewReceipt()), token: PREVIEW_RECEIPT_TOKEN },
  eligibilityError: null,
  audit: null,
};

describe('CheckInStore', () => {
  const enabled = signal(true);
  const authorized = signal(true);
  const lookup = vi.fn<CheckInApi['lookup']>(() => Promise.resolve(RESULT));
  const arrive = vi.fn<CheckInApi['arrive']>(() =>
    Promise.resolve({ ...RESULT, receipt: { ...RESULT.receipt, checkIn: 'CHECKED_IN' } }),
  );
  let store: CheckInStore;
  beforeEach(() => {
    enabled.set(true);
    authorized.set(true);
    vi.clearAllMocks();
    lookup.mockResolvedValue(RESULT);
    arrive.mockResolvedValue({ ...RESULT, receipt: { ...RESULT.receipt, checkIn: 'CHECKED_IN' } });
    TestBed.configureTestingModule({
      providers: [
        CheckInStore,
        {
          provide: CheckInApi,
          useValue: {
            enabled,
            authorized,
            preview: signal(true),
            establishments: () => Promise.resolve([]),
            scenario: signal('ready'),
            publicOrigin: () => 'https://public.mapit.test',
            lookup,
            arrive,
            setScenario: vi.fn(),
          },
        },
      ],
    });
    store = TestBed.inject(CheckInStore);
    store.selectEstablishment(PREVIEW_ESTABLISHMENT_ID);
  });

  it('extrae un token de un origen permitido sin navegar ni llamar a API con una URL', async () => {
    store.setInput('https://public.mapit.test/comprobante/' + PREVIEW_RECEIPT_TOKEN);
    await store.query();
    expect(lookup).toHaveBeenCalledWith(PREVIEW_RECEIPT_TOKEN, PREVIEW_ESTABLISHMENT_ID);
    expect(store.canArrive()).toBe(true);
  });

  it.each([
    'https://evil.test/comprobante/',
    'javascript:',
    'https://public.mapit.test/comprobante/../',
  ])('rechaza URL no confiable %s', async (prefix) => {
    store.setInput(prefix + PREVIEW_RECEIPT_TOKEN);
    await store.query();
    expect(lookup).not.toHaveBeenCalled();
    expect(store.result()).toBeNull();
  });

  it('no consulta ni autoriza si preview o usuario no están habilitados', async () => {
    enabled.set(false);
    store.useDemoCode();
    await store.query();
    expect(lookup).not.toHaveBeenCalled();
    expect(store.canArrive()).toBe(false);
    enabled.set(true);
    authorized.set(false);
    await store.query();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('descarta respuesta tardía cuando cambia el código o establecimiento', async () => {
    const pending = deferred<CheckInResult>();
    lookup.mockReturnValue(pending.promise);
    store.useDemoCode();
    const query = store.query();
    store.selectEstablishment('otro');
    pending.resolve(RESULT);
    await query;
    expect(store.result()).toBeNull();
    expect(store.canArrive()).toBe(false);
    expect(store.querying()).toBe(false);
  });

  it('exige acción explícita e ignora doble click mientras registra llegada', async () => {
    store.useDemoCode();
    await store.query();
    expect(arrive).not.toHaveBeenCalled();
    const pending = deferred<CheckInResult>();
    arrive.mockReturnValue(pending.promise);
    const first = store.arrive();
    await store.arrive();
    expect(arrive).toHaveBeenCalledOnce();
    pending.resolve({ ...RESULT, receipt: { ...RESULT.receipt, checkIn: 'CHECKED_IN' } });
    await first;
    expect(store.canArrive()).toBe(false);
    expect(store.arriving()).toBe(false);
  });

  it('no habilita llegada para un pago pendiente aunque se identifique la reserva', async () => {
    lookup.mockResolvedValue({ ...RESULT, eligibilityError: 'pending' });
    store.useDemoCode();
    await store.query();
    await store.arrive();
    expect(store.canArrive()).toBe(false);
    expect(store.eligibilityMessage()).toContain('no está verificado');
    expect(arrive).not.toHaveBeenCalled();
  });
});
