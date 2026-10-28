import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type AccessibleEstablishment,
  type MockQrConfiguration,
  type PaymentCountry,
  EstablishmentsService,
  MockQrService,
  PaymentPoliciesService,
} from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { of, throwError } from 'rxjs';

import { RuntimeConfigStore } from '../../../core/runtime-config';
import { STRINGS } from '../../../core/strings';
import { PaymentMethods } from './payment-methods';

const { encode } = vi.hoisted(() => ({
  encode: vi.fn<(...args: unknown[]) => Promise<string>>(),
}));
vi.mock('qrcode', () => ({ default: { toDataURL: encode } }));

const ESTABLISHMENT: AccessibleEstablishment = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Centro',
  slug: 'centro',
  address: 'Av. Principal 123',
  timezone: 'America/La_Paz',
  canManagePayments: true,
  canCheckIn: true,
};
const OTHER: AccessibleEstablishment = {
  ...ESTABLISHMENT,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Sucursal',
  address: null,
};
const BOLIVIA: PaymentCountry = { code: 'BO', name: 'Bolivia' };
const PERU: PaymentCountry = { code: 'PE', name: 'Perú' };
const CONFIGURATION: MockQrConfiguration = {
  id: '33333333-3333-4333-8333-333333333333',
  establishmentId: ESTABLISHMENT.id,
  country: 'BO',
  bankName: 'Banco Unión',
  accountHolderName: 'Titular de prueba',
  accountReference: 'cuenta-123',
  enabled: true,
  simulationToken: '44444444-4444-4444-8444-444444444444',
  simulationPath: '/simulacion/qr/44444444-4444-4444-8444-444444444444',
  createdAt: '2026-10-25T12:00:00Z',
  updatedAt: '2026-10-25T12:00:00Z',
};

describe('Configuración QR propio', () => {
  async function setup(environment = 'development', failLoad = false): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [PaymentMethods],
      providers: [
        {
          provide: AuthSession,
          useValue: { user: signal({ id: 'a', tenantId: 'tenant-a', role: 'ADMIN' }) },
        },
        {
          provide: PaymentPoliciesService,
          useValue: {
            getPaymentReadiness: () =>
              of({
                establishmentId: ESTABLISHMENT.id,
                qrEnabled: true,
                ready: false,
                policy: null,
                blockers: ['POLICY_MISSING'],
              }),
            savePaymentPolicy: () => of(null),
          },
        },
        {
          provide: RuntimeConfigStore,
          useValue: {
            config: () => ({ environment, paymentPublicOrigin: 'https://public.example' }),
          },
        },
        {
          provide: MockQrService,
          useValue: {
            listMockQrConfigurations: () =>
              failLoad ? throwError(() => ({ status: 503 })) : of([{ ...CONFIGURATION }]),
            listMockQrCountries: () => of([BOLIVIA, PERU]),
            createMockQrConfiguration: () => of({ ...CONFIGURATION }),
            updateMockQrConfiguration: () => of({ ...CONFIGURATION }),
            regenerateMockQrConfiguration: () => of({ ...CONFIGURATION }),
          },
        },
        {
          provide: EstablishmentsService,
          useValue: { listAccessibleEstablishments: () => of([ESTABLISHMENT, OTHER]) },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PaymentMethods);
    const element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    if (environment !== 'production' && !failLoad) {
      await vi.waitFor(() => expect(element.querySelector('.qr-image')).not.toBeNull());
    } else if (failLoad) {
      await vi.waitFor(() => expect(element.querySelector('[role="alert"]')).not.toBeNull());
    }
    return element;
  }

  beforeEach(() => {
    encode.mockReset();
    encode.mockResolvedValue('data:image/png;base64,qr');
  });

  it('muestra establecimientos y países reales, y el QR identificado como prueba', async () => {
    const element = await setup();

    expect(element.textContent).toContain(STRINGS.paymentMethods.title);
    expect(element.textContent).toContain(STRINGS.paymentMethods.mockLabel);
    expect(element.textContent).toContain('Centro');
    expect(element.querySelectorAll('[role="combobox"]')).toHaveLength(2);
    expect(element.querySelector('select')).toBeNull();
    expect(element.querySelector<HTMLInputElement>('#establishmentId')?.value).toBe('Centro');
    expect(element.querySelector<HTMLInputElement>('#country')?.value).toBe('Bolivia (BO)');
    const image = element.querySelector<HTMLImageElement>('.qr-image');
    expect(image?.src).toContain('data:image/png;base64,qr');
    expect(image?.alt).toBe(STRINGS.paymentMethods.qrAlt);
    expect(element.textContent).toContain(
      'https://public.example/simulacion/qr/44444444-4444-4444-8444-444444444444',
    );
  });

  it('explica QR activo sin confundirlo con cobro listo; muestra policy vacía sin guardarla', async () => {
    const root = await setup();
    expect(root.querySelector('[data-testid="qr-active"]')?.textContent).toContain(
      STRINGS.paymentMethods.yes,
    );
    expect(root.querySelector('[data-testid="charge-ready"]')?.textContent).toContain(
      STRINGS.paymentMethods.notReady,
    );
    expect(root.querySelector('[data-testid="readiness-blockers"]')?.textContent).toContain(
      STRINGS.paymentMethods.blockers.POLICY_MISSING,
    );
    expect(root.querySelector<HTMLInputElement>('[data-testid="policy-currency"]')?.value).toBe('');
    expect(
      root.querySelector<HTMLInputElement>('[data-testid="policy-enabled-true"]')?.checked,
    ).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('[data-testid="policy-save"]')?.disabled).toBe(
      true,
    );
  });

  it('mantiene visible el formulario y el error cuando falla la carga inicial', async () => {
    const element = await setup('development', true);

    expect(element.querySelector('form.method-editor')).not.toBeNull();
    expect(element.querySelector('.saved-panel')).not.toBeNull();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      STRINGS.paymentMethods.loadError,
    );
  });

  it('filtra los selectores por nombre y por código ISO', async () => {
    const element = await setup();
    const countrySearch = element.querySelector<HTMLInputElement>('#country')!;
    countrySearch.value = 'peru';
    countrySearch.dispatchEvent(new Event('input'));
    TestBed.tick();
    expect(element.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(element.querySelector('[role="option"]')?.textContent).toContain('Perú (PE)');
    countrySearch.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    TestBed.tick();
    expect(countrySearch.value).toBe('Perú (PE)');
    expect(countrySearch.getAttribute('aria-expanded')).toBe('false');

    const establishmentSearch = element.querySelector<HTMLInputElement>('#establishmentId')!;
    establishmentSearch.value = 'sucursal';
    establishmentSearch.dispatchEvent(new Event('input'));
    TestBed.tick();
    expect(element.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(element.querySelector('[role="option"]')?.textContent).toContain('Sucursal');
    element.querySelector<HTMLButtonElement>('[role="option"]')!.click();
    TestBed.tick();
    expect(establishmentSearch.value).toBe('Sucursal');
  });

  it('explica que el mock no está disponible fuera de desarrollo', async () => {
    const element = await setup('production');
    expect(element.textContent).toContain(STRINGS.paymentMethods.developmentOnly);
    expect(element.querySelector('form')).toBeNull();
  });
});
