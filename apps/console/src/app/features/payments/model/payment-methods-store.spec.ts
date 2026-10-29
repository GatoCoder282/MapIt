import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type AccessibleEstablishment,
  type MockQrConfiguration,
  type MockQrConfigurationWrite,
  type PaymentCountry,
  type PaymentReadiness,
  EstablishmentsService,
  MockQrService,
  PaymentPoliciesService,
} from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { of, Subject, throwError } from 'rxjs';

import { RuntimeConfigStore } from '../../../core/runtime-config';
import { STRINGS } from '../../../core/strings';
import { PaymentMethodsStore } from './payment-methods-store';

const { encode } = vi.hoisted(() => ({
  encode: vi.fn<(...args: unknown[]) => Promise<string>>(),
}));
vi.mock('qrcode', () => ({ default: { toDataURL: encode } }));

const USER = { id: 'admin-a', tenantId: 'tenant-a', role: 'ADMIN' };
const ESTABLISHMENT: AccessibleEstablishment = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Centro',
  slug: 'centro',
  address: 'Av. Principal 123',
  timezone: 'America/La_Paz',
  canManagePayments: true,
  canCheckIn: true,
};
const OTHER_ESTABLISHMENT: AccessibleEstablishment = {
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

describe('PaymentMethodsStore', () => {
  const user = signal<{ id: string; tenantId: string; role: string } | null>({ ...USER });
  const configurations: MockQrConfiguration[] = [{ ...CONFIGURATION }];
  const listConfigurations = vi.fn(() => of(configurations));
  const listCountries = vi.fn(() => of([BOLIVIA, PERU]));
  const listEstablishments = vi.fn(() => of([ESTABLISHMENT, OTHER_ESTABLISHMENT]));
  const createConfiguration = vi.fn(
    (request: { mockQrConfigurationWrite: MockQrConfigurationWrite }) =>
      of(saved('55555555-5555-4555-8555-555555555555', request.mockQrConfigurationWrite)),
  );
  const updateConfiguration = vi.fn(
    (request: { configurationId: string; mockQrConfigurationWrite: MockQrConfigurationWrite }) =>
      of(saved(request.configurationId, request.mockQrConfigurationWrite)),
  );
  const regenerateConfiguration = vi.fn((request: { configurationId: string }) =>
    of({
      ...configurations[0],
      id: request.configurationId,
      simulationToken: '66666666-6666-4666-8666-666666666666',
      simulationPath: '/simulacion/qr/66666666-6666-4666-8666-666666666666',
    }),
  );
  const getReadiness = vi.fn((_request: { establishmentId: string }) =>
    of<PaymentReadiness>({
      establishmentId: ESTABLISHMENT.id,
      qrEnabled: true,
      policy: null,
      ready: false,
      blockers: ['POLICY_MISSING'],
    }),
  );
  const savePolicy = vi.fn((request: { paymentPolicy: unknown }) => of(request.paymentPolicy));

  let store: PaymentMethodsStore;

  function setup(environment = 'development', api = apiStub()): void {
    TestBed.configureTestingModule({
      providers: [
        PaymentMethodsStore,
        { provide: AuthSession, useValue: { user } },
        {
          provide: RuntimeConfigStore,
          useValue: {
            config: () => ({
              environment,
              paymentPublicOrigin: 'https://public.example',
            }),
          },
        },
        { provide: MockQrService, useValue: api.qr },
        { provide: EstablishmentsService, useValue: api.establishments },
        {
          provide: PaymentPoliciesService,
          useValue: { getPaymentReadiness: getReadiness, savePaymentPolicy: savePolicy },
        },
      ],
    });
    store = TestBed.inject(PaymentMethodsStore);
    TestBed.tick();
  }

  function apiStub(): {
    qr: Record<string, unknown>;
    establishments: Record<string, unknown>;
  } {
    return {
      qr: {
        listMockQrConfigurations: listConfigurations,
        listMockQrCountries: listCountries,
        createMockQrConfiguration: createConfiguration,
        updateMockQrConfiguration: updateConfiguration,
        regenerateMockQrConfiguration: regenerateConfiguration,
      },
      establishments: { listAccessibleEstablishments: listEstablishments },
    };
  }

  beforeEach(() => {
    user.set({ ...USER });
    configurations.splice(0, configurations.length, { ...CONFIGURATION });
    encode.mockReset();
    encode.mockResolvedValue('data:image/png;base64,qr');
    listConfigurations.mockClear();
    listCountries.mockClear();
    listEstablishments.mockClear();
    createConfiguration.mockClear();
    updateConfiguration.mockClear();
    regenerateConfiguration.mockClear();
    getReadiness.mockReset().mockImplementation(() =>
      of({
        establishmentId: ESTABLISHMENT.id,
        qrEnabled: true,
        policy: null,
        ready: false,
        blockers: ['POLICY_MISSING'],
      }),
    );
    savePolicy.mockClear();
  });

  it('distinguishes active QR from checkout readiness and requires intentional policy values', async () => {
    setup();
    await vi.waitFor(() => expect(store.readiness()?.blockers).toContain('POLICY_MISSING'));
    expect(store.readiness()?.qrEnabled).toBe(true);
    expect(store.readiness()?.ready).toBe(false);
    expect(store.policyDraft().currency).toBe('');
    expect(savePolicy).not.toHaveBeenCalled();
    store.setPolicyCurrency('KWD');
    store.setPolicyDeposit('1.234');
    store.setPolicyWindow('15');
    store.setPolicyEnabled(true);
    expect(store.canSavePolicy()).toBe(true);
    await store.savePolicy();
    expect(savePolicy).toHaveBeenCalledWith({
      establishmentId: ESTABLISHMENT.id,
      paymentPolicy: {
        currency: 'KWD',
        depositAmount: '1.234',
        totalAmount: null,
        paymentWindowMinutes: 15,
        enabled: true,
      },
    });
    expect(getReadiness).toHaveBeenCalledTimes(2);
  });

  it('shows policySaved success message after a successful save and reloads readiness', async () => {
    getReadiness
      .mockImplementationOnce(() =>
        of({
          establishmentId: ESTABLISHMENT.id,
          qrEnabled: true,
          policy: null,
          ready: false,
          blockers: ['POLICY_MISSING' as const],
        }),
      )
      .mockImplementationOnce(() =>
        of({
          establishmentId: ESTABLISHMENT.id,
          qrEnabled: true,
          policy: {
            enabled: true,
            currency: 'USD',
            depositAmount: '10.00',
            totalAmount: null,
            paymentWindowMinutes: 30,
          },
          ready: true,
          blockers: [],
        }),
      );
    setup();
    await vi.waitFor(() => expect(store.readiness()?.blockers).toContain('POLICY_MISSING'));
    store.setPolicyCurrency('USD');
    store.setPolicyDeposit('10.00');
    store.setPolicyWindow('30');
    store.setPolicyEnabled(true);
    expect(store.policySuccess()).toBeNull();
    await store.savePolicy();
    await vi.waitFor(() => expect(store.policySuccess()).toBe(STRINGS.paymentMethods.policySaved));
    expect(store.policyError()).toBeNull();
    expect(store.readiness()?.ready).toBe(true);
  });

  it('shows policySaveError when the API rejects the policy write', async () => {
    setup();
    await vi.waitFor(() => expect(store.readiness()).not.toBeNull());
    savePolicy.mockImplementationOnce(() => throwError(() => ({ status: 400 })));
    store.setPolicyCurrency('USD');
    store.setPolicyDeposit('10.00');
    store.setPolicyWindow('30');
    store.setPolicyEnabled(true);
    await store.savePolicy();
    await vi.waitFor(() =>
      expect(store.policyError()).toBe(STRINGS.paymentMethods.policySaveError),
    );
    expect(store.policySuccess()).toBeNull();
  });

  it('does not misrepresent readiness HTTP 404 as missing policy', async () => {
    getReadiness.mockImplementation(() => throwError(() => ({ status: 404 })));
    setup();
    await vi.waitFor(() => expect(store.readinessError()).toBeTruthy());
    expect(store.readiness()).toBeNull();
  });

  it('shows a permission error rather than missing policy on readiness HTTP 403', async () => {
    getReadiness.mockImplementation(() => throwError(() => ({ status: 403 })));
    setup();
    await vi.waitFor(() =>
      expect(store.readinessError()).toBe(STRINGS.paymentMethods.readinessForbidden),
    );
    expect(store.readiness()).toBeNull();
    expect(savePolicy).not.toHaveBeenCalled();
  });

  it('accepts zero-decimal JPY and three-decimal KWD, rejects a false generic two-decimal limit', async () => {
    setup();
    await vi.waitFor(() => expect(store.readiness()).not.toBeNull());
    store.setPolicyEnabled(false);
    store.setPolicyWindow('5');
    store.setPolicyCurrency('JPY');
    store.setPolicyDeposit('125');
    expect(store.canSavePolicy()).toBe(true);
    store.setPolicyDeposit('125.01');
    expect(store.canSavePolicy()).toBe(false);
    store.setPolicyCurrency('KWD');
    store.setPolicyDeposit('1.234');
    store.setPolicyTotal('1.233');
    expect(store.canSavePolicy()).toBe(false);
    store.setPolicyTotal('2.001');
    expect(store.canSavePolicy()).toBe(true);
  });

  it('isolates a changed establishment and never treats a disabled policy as ready', async () => {
    getReadiness.mockImplementation(({ establishmentId }: { establishmentId: string }) =>
      of({
        establishmentId,
        qrEnabled: true,
        policy: {
          enabled: false,
          currency: 'BOB',
          depositAmount: '10.00',
          totalAmount: null,
          paymentWindowMinutes: 30,
        },
        ready: false,
        blockers: ['POLICY_DISABLED'],
      }),
    );
    setup();
    await vi.waitFor(() => expect(store.readiness()?.blockers).toContain('POLICY_DISABLED'));
    store.setEstablishment(OTHER_ESTABLISHMENT.id);
    await vi.waitFor(() => expect(store.readiness()?.establishmentId).toBe(OTHER_ESTABLISHMENT.id));
    expect(savePolicy).not.toHaveBeenCalled();
  });

  it('allows saving the new establishment after an earlier policy write finishes', async () => {
    getReadiness.mockImplementation(({ establishmentId }: { establishmentId: string }) =>
      of({
        establishmentId,
        qrEnabled: true,
        policy: null,
        ready: false,
        blockers: ['POLICY_MISSING'],
      }),
    );
    setup();
    await vi.waitFor(() => expect(store.readiness()).not.toBeNull());
    const pending = new Subject<unknown>();
    savePolicy.mockImplementationOnce(() => pending.asObservable());
    store.setPolicyCurrency('USD');
    store.setPolicyDeposit('10.00');
    store.setPolicyWindow('30');
    store.setPolicyEnabled(true);
    const firstSave = store.savePolicy();
    store.setEstablishment(OTHER_ESTABLISHMENT.id);
    await vi.waitFor(() => expect(store.readiness()?.establishmentId).toBe(OTHER_ESTABLISHMENT.id));
    store.setPolicyCurrency('KWD');
    store.setPolicyDeposit('1.234');
    store.setPolicyWindow('15');
    store.setPolicyEnabled(false);
    pending.next({});
    pending.complete();
    await firstSave;
    expect(store.canSavePolicy()).toBe(true);
    await store.savePolicy();
    expect(savePolicy).toHaveBeenLastCalledWith({
      establishmentId: OTHER_ESTABLISHMENT.id,
      paymentPolicy: {
        currency: 'KWD',
        depositAmount: '1.234',
        totalAmount: null,
        paymentWindowMinutes: 15,
        enabled: false,
      },
    });
  });

  it('never offers policy writes to manager or platform role', async () => {
    user.set({ ...USER, role: 'MANAGER' });
    setup();
    await vi.waitFor(() => expect(store.configurations()).toHaveLength(1));
    expect(getReadiness).not.toHaveBeenCalled();
    await store.savePolicy();
    expect(savePolicy).not.toHaveBeenCalled();
  });

  it('carga establecimientos accesibles, países y configuraciones persistidas', async () => {
    setup();
    await vi.waitFor(() => expect(store.configurations()).toHaveLength(1));

    expect(store.draft()).toEqual({
      establishmentId: ESTABLISHMENT.id,
      country: 'BO',
      bankName: 'Banco Unión',
      accountHolderName: 'Titular de prueba',
      accountReference: 'cuenta-123',
      enabled: true,
    });
    expect(store.establishmentName(ESTABLISHMENT.id)).toBe('Centro');
    expect(store.countryName('BO')).toBe('Bolivia');
    await vi.waitFor(() => expect(store.qr()).toBe('data:image/png;base64,qr'));
    expect(store.qrUrl()).toBe(
      'https://public.example/simulacion/qr/44444444-4444-4444-8444-444444444444',
    );
  });

  it('rechaza texto libre o identificadores que no pertenecen al catálogo del tenant', async () => {
    setup();
    await vi.waitFor(() => expect(store.countries()).toHaveLength(2));

    store.startNew();
    store.setEstablishment('Centro');
    store.setCountry('BO');
    store.setBankName('Banco de prueba');
    store.setAccountHolder('Titular de prueba');
    store.setAccountReference('Referencia');
    expect(store.canSave()).toBe(false);
    await store.save();
    expect(createConfiguration).not.toHaveBeenCalled();

    store.setEstablishment(ESTABLISHMENT.id);
    store.setCountry('XX');
    expect(store.canSave()).toBe(false);
    await store.save();
    expect(createConfiguration).not.toHaveBeenCalled();

    store.setCountry('BO');
    expect(store.canSave()).toBe(true);
  });

  it('guarda una configuración nueva con establecimiento real y código ISO', async () => {
    setup();
    await vi.waitFor(() => expect(store.configurations()).toHaveLength(1));
    store.startNew();
    store.setEstablishment(OTHER_ESTABLISHMENT.id);
    store.setCountry('PE');
    store.setBankName(' Banco de prueba ');
    store.setAccountHolder(' Titular ');
    store.setAccountReference(' cuenta-999 ');
    store.setEnabled(false);

    await store.save();

    expect(createConfiguration).toHaveBeenCalledWith({
      mockQrConfigurationWrite: {
        establishmentId: OTHER_ESTABLISHMENT.id,
        country: 'PE',
        bankName: 'Banco de prueba',
        accountHolderName: 'Titular',
        accountReference: 'cuenta-999',
        enabled: false,
      },
    });
    expect(store.configurations()).toHaveLength(2);
    expect(store.success()).toBe(STRINGS.paymentMethods.success);
    expect(store.error()).toBeNull();
  });

  it('rechaza campos obligatorios vacíos sin llamar a la API', async () => {
    setup();
    await vi.waitFor(() => expect(store.configurations()).toHaveLength(1));
    store.startNew();
    store.setEstablishment(ESTABLISHMENT.id);
    store.setCountry('BO');
    store.setBankName(' ');

    await store.save();

    expect(createConfiguration).not.toHaveBeenCalled();
    expect(store.error()).toBe(STRINGS.paymentMethods.invalid);
    expect(store.success()).toBeNull();
  });

  it('activa o desactiva y regenera el token persistido', async () => {
    setup();
    await vi.waitFor(() => expect(store.configurations()).toHaveLength(1));

    await store.toggle(store.configurations()[0]!);
    expect(updateConfiguration).toHaveBeenCalledWith({
      configurationId: CONFIGURATION.id,
      mockQrConfigurationWrite: {
        establishmentId: ESTABLISHMENT.id,
        country: 'BO',
        bankName: 'Banco Unión',
        accountHolderName: 'Titular de prueba',
        accountReference: 'cuenta-123',
        enabled: false,
      },
    });

    await store.regenerate();
    expect(regenerateConfiguration).toHaveBeenCalledWith({ configurationId: CONFIGURATION.id });
    expect(store.selectedConfiguration()?.simulationToken).toBe(
      '66666666-6666-4666-8666-666666666666',
    );
    expect(store.qrUrl()).toBe(
      'https://public.example/simulacion/qr/66666666-6666-4666-8666-666666666666',
    );
  });

  it('nunca codifica banco, titular ni cuenta dentro del QR', async () => {
    setup();
    await vi.waitFor(() => expect(encode).toHaveBeenCalled());

    const target = encode.mock.calls[0]![0] as string;
    expect(target).toBe(
      'https://public.example/simulacion/qr/44444444-4444-4444-8444-444444444444',
    );
    expect(target).not.toContain(CONFIGURATION.bankName);
    expect(target).not.toContain(CONFIGURATION.accountHolderName);
    expect(target).not.toContain(CONFIGURATION.accountReference);
  });

  it('bloquea el mock fuera de desarrollo y limpia los datos al cambiar de usuario', async () => {
    setup('production');
    await Promise.resolve();
    expect(store.allowed).toBe(false);
    expect(listConfigurations).not.toHaveBeenCalled();

    user.set({ id: 'admin-b', tenantId: 'tenant-b', role: 'ADMIN' });
    TestBed.tick();
    expect(store.configurations()).toEqual([]);
    expect(store.draft().bankName).toBe('');
  });

  it('traduce permisos y entornos no disponibles a mensajes de la pantalla', async () => {
    const api = apiStub();
    api.qr['listMockQrConfigurations'] = () => throwError(() => ({ status: 403 }));
    setup('development', api);
    await vi.waitFor(() => expect(store.error()).toBe(STRINGS.paymentMethods.forbidden));

    const unavailable = apiStub();
    unavailable.qr['listMockQrConfigurations'] = () => throwError(() => ({ status: 404 }));
    TestBed.resetTestingModule();
    setup('development', unavailable);
    await vi.waitFor(() => expect(store.error()).toBe(STRINGS.paymentMethods.unavailable));
  });
});

function saved(id: string, write: MockQrConfigurationWrite): MockQrConfiguration {
  return {
    ...write,
    id,
    simulationToken: '55555555-5555-4555-8555-555555555555',
    simulationPath: '/simulacion/qr/55555555-5555-4555-8555-555555555555',
    createdAt: '2026-10-25T12:00:00Z',
    updatedAt: '2026-10-25T12:00:00Z',
  };
}
