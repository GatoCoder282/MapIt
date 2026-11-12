import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import {
  type AccessibleEstablishment,
  type MockQrConfiguration,
  type PaymentCountry,
  type PaymentMethodWrite,
  MockQrService,
  PaymentPoliciesService,
  PaymentsService,
} from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { of, throwError } from 'rxjs';

import { RuntimeConfigStore } from '../../../core/runtime-config';
import { EstablishmentContext } from '../../../core/establishment-context';
import { STRINGS } from '../../../core/strings';
import { PaymentMethods } from './payment-methods';

const { encode } = vi.hoisted(() => ({
  encode: vi.fn<(...args: unknown[]) => Promise<string>>(),
}));
vi.mock('qrcode', () => ({ default: { toDataURL: encode } }));

const createCatalogMethod = vi.fn(
  ({ paymentMethodWrite }: { paymentMethodWrite: PaymentMethodWrite }) =>
    of({
      ...paymentMethodWrite,
      id: '55555555-5555-4555-8555-555555555555',
      verification: 'AUTOMATIC',
      createdAt: '2026-10-25T12:00:00Z',
      updatedAt: '2026-10-25T12:00:00Z',
    }),
);

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

describe('Métodos de pago', () => {
  let fixture: ComponentFixture<PaymentMethods>;

  function render(): void {
    TestBed.tick();
    fixture.detectChanges();
  }

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
          provide: PaymentsService,
          useValue: { listPaymentMethods: () => of([]), createPaymentMethod: createCatalogMethod },
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
          provide: EstablishmentContext,
          useValue: {
            active: signal(ESTABLISHMENT),
            status: signal('ready'),
            establishments: signal([ESTABLISHMENT, OTHER]),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PaymentMethods);
    const element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => {
      render();
      expect(button(element, 'Agregar método').disabled).toBe(false);
      if (failLoad) {
        expect(element.querySelector('[role="alert"]')).not.toBeNull();
      } else if (environment === 'development') {
        expect(element.textContent).toContain(CONFIGURATION.bankName);
        expect(encode).toHaveBeenCalled();
      }
    });
    return element;
  }

  function button(root: HTMLElement, label: string): HTMLButtonElement {
    const found = Array.from(root.querySelectorAll('button')).find(
      (button) => (button.getAttribute('aria-label') ?? button.textContent?.trim()) === label,
    );
    expect(found, label).toBeDefined();
    return found!;
  }

  function click(root: HTMLElement, label: string): void {
    button(root, label).click();
    render();
  }

  function openMockActions(root: HTMLElement): HTMLElement {
    click(
      root,
      STRINGS.paymentFlow.rowActions.replace(
        '{name}',
        `${STRINGS.paymentFlow.mock} · ${CONFIGURATION.bankName}`,
      ),
    );
    const menu = document.querySelector<HTMLElement>('[role="menu"]');
    expect(menu).not.toBeNull();
    return menu!;
  }

  function chooseType(root: HTMLElement, label: string): void {
    const radio = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(
      (input) => Array.from(input.labels ?? []).some((item) => item.textContent?.includes(label)),
    );
    expect(radio, label).toBeDefined();
    radio!.click();
    render();
  }

  function fill(root: HTMLElement, fields: Record<string, string>): void {
    for (const [name, value] of Object.entries(fields)) {
      const input = root.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    render();
  }

  beforeEach(() => {
    createCatalogMethod.mockClear();
    encode.mockReset();
    encode.mockResolvedValue('data:image/png;base64,qr');
  });

  it('muestra el establecimiento activo y conserva país y QR identificado como prueba', async () => {
    const element = await setup();

    expect(element.textContent).toContain(STRINGS.paymentFlow.title);
    expect(element.textContent).toContain('Centro');
    expect(element.querySelector('[role="group"]')?.getAttribute('title')).toBe(
      'Av. Principal 123',
    );
    expect(element.querySelectorAll('[role="combobox"]')).toHaveLength(0);
    expect(element.textContent).not.toContain(STRINGS.paymentMethods.edit);
    const menu = openMockActions(element);
    expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(2);
    click(menu, 'Editar');
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(element.querySelectorAll('[role="combobox"]')).toHaveLength(1);
    expect(element.querySelector('select')).toBeNull();
    expect(element.querySelector('#establishmentId')).toBeNull();
    expect(element.querySelector<HTMLInputElement>('#country')?.value).toBe('Bolivia (BO)');
    await vi.waitFor(() => {
      render();
      const image = element.querySelector<HTMLImageElement>('.qr-image');
      expect(image?.src).toContain('data:image/png;base64,qr');
      expect(image?.alt).toBe(STRINGS.paymentMethods.qrAlt);
    });
  });

  it('resume los métodos visibles con iconos y contadores derivados del estado real', async () => {
    const element = await setup();
    const summary = element.querySelector('.collection-summary')!;

    expect(summary.querySelectorAll('dl > div')).toHaveLength(2);
    expect(summary.querySelector('dl > div:first-child dd')?.textContent?.trim()).toMatch(/^1\s/);
    expect(summary.querySelector('dl > div:last-child dd')?.textContent?.trim()).toMatch(/^0\s/);
    expect(summary.querySelectorAll('dd svg[aria-hidden="true"]')).toHaveLength(2);
  });

  it('explica QR activo sin confundirlo con cobro listo; muestra policy vacía sin guardarla', async () => {
    const root = await setup();
    click(root, 'Políticas generales');
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

  it('muestra el error de carga sin abrir el formulario', async () => {
    const element = await setup('development', true);

    expect(element.querySelector('form')).toBeNull();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      STRINGS.paymentMethods.loadError,
    );
  });

  it('conserva la búsqueda accesible de país, sin selector operativo de establecimiento', async () => {
    const element = await setup();
    click(openMockActions(element), 'Editar');
    const countrySearch = element.querySelector<HTMLInputElement>('#country')!;
    countrySearch.value = 'peru';
    countrySearch.dispatchEvent(new Event('input'));
    render();
    expect(element.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(element.querySelector('[role="option"]')?.textContent).toContain('Perú (PE)');
    countrySearch.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    render();
    expect(countrySearch.value).toBe('Perú (PE)');
    expect(countrySearch.getAttribute('aria-expanded')).toBe('false');

    expect(element.querySelector('#establishmentId')).toBeNull();
    expect(element.querySelector<HTMLInputElement>('#country')).not.toBeNull();
    expect(element.querySelectorAll('[role="combobox"]')).toHaveLength(1);
  });

  it('omite Mock fuera de desarrollo y permite cancelar la selección de tipo', async () => {
    const element = await setup('production');
    click(element, 'Agregar método');
    expect(element.textContent).toContain('QR bancario propio');
    expect(element.textContent).toContain('Pasarela integrada');
    expect(element.textContent).not.toContain('Mock (desarrollo)');
    expect(button(element, 'Siguiente').disabled).toBe(true);
    click(element, 'Cancelar');
    expect(element.querySelector('form')).toBeNull();
    expect(element.textContent).toContain(STRINGS.paymentFlow.title);
  });

  it('conserva el borrador al volver de revisión y exige datos válidos antes de avanzar', async () => {
    const element = await setup();
    click(element, 'Agregar método');
    chooseType(element, 'Mock (desarrollo)');
    click(element, 'Siguiente');
    click(element, 'Siguiente');
    expect(element.querySelector('h1')?.textContent?.trim()).toBe(STRINGS.paymentFlow.mockTitle);

    const country = element.querySelector<HTMLInputElement>('#country')!;
    country.value = 'Bolivia';
    country.dispatchEvent(new Event('input'));
    render();
    country.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fill(element, {
      bankName: 'Banco de prueba',
      accountHolderName: 'Titular de prueba',
      accountReference: 'REFERENCIA-DEMO',
    });
    click(element, 'Siguiente');
    expect(element.textContent).toContain('REFERENCIA-DEMO');
    click(element, 'Anterior');
    expect(element.querySelector<HTMLInputElement>('#country')?.value).toBe('Bolivia (BO)');
    expect(element.querySelector<HTMLInputElement>('input[name="accountReference"]')?.value).toBe(
      'REFERENCIA-DEMO',
    );
  });

  it('guarda la pasarela inactiva para el establecimiento y confirma el estado devuelto', async () => {
    const element = await setup('production');
    click(element, 'Agregar método');
    chooseType(element, 'Pasarela integrada');
    click(element, 'Siguiente');
    expect(element.querySelector('input[name="enabled"]')).toBeNull();
    fill(element, {
      displayName: 'Pasarela de prueba',
      country: 'BO',
      currency: 'BOB',
      bankName: 'Banco de prueba',
      accountHolderName: 'Titular de prueba',
      accountReference: 'pasarela-prueba',
    });
    click(element, 'Siguiente');
    click(element, 'Guardar método');

    await vi.waitFor(() => {
      render();
      expect(element.querySelector('h1')?.textContent?.trim()).toBe(STRINGS.paymentFlow.created);
    });
    expect(createCatalogMethod.mock.calls[0]?.[0].paymentMethodWrite).toMatchObject({
      establishmentId: ESTABLISHMENT.id,
      enabled: false,
      provider: 'INTEGRATED_GATEWAY',
    });
    expect(element.textContent).toContain(STRINGS.paymentMethods.no);
  });
});
