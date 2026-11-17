import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { AuthSession } from '@mapit/auth';
import type { AccessibleEstablishment } from '@mapit/api-client';
import { BehaviorSubject } from 'rxjs';

import { routes } from '../app.routes';
import { EstablishmentContext } from '../core/establishment-context';
import { StaffShell } from './staff-shell';

const ESTABLISHMENTS: AccessibleEstablishment[] = [
  {
    id: 'venue-1',
    name: 'Casa Norte',
    slug: 'casa-norte',
    address: null,
    timezone: 'America/Montevideo',
    canManagePayments: false,
    canCheckIn: true,
  },
  {
    id: 'venue-2',
    name: 'Casa Sur',
    slug: 'casa-sur',
    address: 'Calle Sur',
    timezone: 'America/Montevideo',
    canManagePayments: false,
    canCheckIn: true,
  },
];

async function mountShell(options?: {
  active?: ReturnType<typeof signal<AccessibleEstablishment | null>>;
  status?: ReturnType<typeof signal<'idle' | 'loading' | 'ready' | 'error'>>;
  query?: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  role?: 'ADMIN' | 'STAFF';
  establishments?: readonly AccessibleEstablishment[];
  onSetup?: boolean;
}) {
  const user = signal({
    id: 'staff-1',
    tenantId: 'tenant-a',
    fullName: 'Test User',
    role: options?.role ?? 'STAFF',
  });
  const active = options?.active ?? signal<AccessibleEstablishment | null>(ESTABLISHMENTS[0]!);
  const status = options?.status ?? signal<'idle' | 'loading' | 'ready' | 'error'>('ready');
  const query = options?.query ?? new BehaviorSubject(convertToParamMap({}));
  const load = vi.fn(() => {
    active.set(null);
    return Promise.resolve();
  });
  const confirm = vi.fn((id: string) => {
    const establishment = ESTABLISHMENTS.find((item) => item.id === id);
    if (!establishment) return false;
    active.set(establishment);
    return true;
  });
  const context = {
    establishments: signal(options?.establishments ?? ESTABLISHMENTS),
    active,
    status,
    load,
    confirm,
  };

  await TestBed.configureTestingModule({
    imports: [StaffShell],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { queryParamMap: query.asObservable() } },
      { provide: AuthSession, useValue: { user, logout: vi.fn() } },
      { provide: EstablishmentContext, useValue: context },
    ],
  }).compileComponents();

  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  if (options?.onSetup) vi.spyOn(router, 'isActive').mockReturnValue(true);
  const fixture = TestBed.createComponent(StaffShell);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  return { fixture, host, active, context, navigate, navigateByUrl, query, router, user };
}

describe('StaffShell navigation', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open');
      },
    });
  });

  it('shows payment, check-in and audit links only for authorized roles', async () => {
    const user = signal({
      id: 'staff-1',
      tenantId: 'tenant-a',
      fullName: 'Test User',
      role: 'ADMIN',
    });
    const active = signal({
      id: 'venue-1',
      name: 'Casa Norte',
      slug: 'casa-norte',
      address: null,
      timezone: 'America/Montevideo',
      canManagePayments: false,
      canCheckIn: true,
    });
    await TestBed.configureTestingModule({
      imports: [StaffShell],
      providers: [
        provideRouter([]),
        { provide: AuthSession, useValue: { user, logout: vi.fn() } },
        {
          provide: EstablishmentContext,
          useValue: {
            establishments: signal([]),
            active,
            status: signal('ready'),
            load: vi.fn(),
            confirm: vi.fn(() => true),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(StaffShell);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('mapit-establishment-selector')).toBeNull();
    const labels = () =>
      Array.from(host.querySelectorAll('nav a')).map((link) => link.textContent?.trim());

    expect(labels()).toEqual(
      expect.arrayContaining(['Métodos de pago', 'Recepción y check-in', 'Auditoría']),
    );

    user.set({ id: 'staff-1', tenantId: 'tenant-a', fullName: 'Test User', role: 'STAFF' });
    fixture.detectChanges();
    expect(labels()).toContain('Recepción y check-in');
    expect(labels()).not.toContain('Métodos de pago');
    expect(labels()).not.toContain('Auditoría');
  }, 15000);

  it('blocks the router outlet until a validated establishment is active', async () => {
    const user = signal({
      id: 'staff-1',
      tenantId: 'tenant-a',
      fullName: 'Test User',
      role: 'STAFF',
    });
    const active = signal<null | { id: string; name: string }>(null);
    const status = signal('idle');
    const context = {
      establishments: signal([
        {
          id: 'venue-1',
          name: 'Casa Norte',
          slug: 'casa-norte',
          address: null,
          timezone: 'America/Montevideo',
          canManagePayments: false,
          canCheckIn: true,
        },
      ]),
      active,
      status,
      load: vi.fn(),
      confirm: vi.fn(() => true),
    };
    await TestBed.configureTestingModule({
      imports: [StaffShell],
      providers: [
        provideRouter([]),
        { provide: AuthSession, useValue: { user, logout: vi.fn() } },
        { provide: EstablishmentContext, useValue: context },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(StaffShell);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('router-outlet')).toBeNull();
    expect(host.querySelector('mapit-establishment-selector')).toBeNull();
    expect(host.textContent).toContain('Cargando establecimientos');
    expect(host.textContent).not.toContain('¿Con cuál establecimiento querés entrar?');

    status.set('ready');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('mapit-establishment-selector')).not.toBeNull();
    expect(host.querySelector('router-outlet')).toBeNull();

    active.set({ id: 'venue-1', name: 'Casa Norte' });
    fixture.detectChanges();
    expect(host.querySelector('router-outlet')).not.toBeNull();
    expect(host.querySelector('mapit-establishment-selector')).toBeNull();
  });

  it('redirects the old establishment route to explicit selection on Home', () => {
    const staffShell = routes.find((route) => route.path === '' && route.children);
    const oldRoute = staffShell?.children?.find((route) => route.path === 'establishments');
    expect(oldRoute?.redirectTo).toBe('/home?selectEstablishment=1');
    expect(oldRoute?.loadComponent).toBeUndefined();
  });

  it('opens the selector and refreshes even with an active establishment on explicit request', async () => {
    const query = new BehaviorSubject(convertToParamMap({}));
    const { fixture, host, context, query: currentQuery } = await mountShell({ query });
    expect(host.querySelector('mapit-establishment-selector')).toBeNull();

    currentQuery.next(convertToParamMap({ selectEstablishment: '1' }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(context.load).toHaveBeenCalledOnce();
    expect(host.querySelector('mapit-establishment-selector')).not.toBeNull();
    expect(host.querySelector('router-outlet')).toBeNull();
  });

  it('confirms an authorized explicit choice and navigates to Home without the marker', async () => {
    const query = new BehaviorSubject(convertToParamMap({ selectEstablishment: '1' }));
    const { fixture, host, context, navigate } = await mountShell({ query });
    const radios = host.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    const secondRadio = radios.item(1);
    expect(secondRadio).not.toBeNull();
    secondRadio?.click();
    fixture.detectChanges();
    (host.querySelector('[data-testid="continue"]') as HTMLButtonElement).click();

    expect(context.confirm).toHaveBeenCalledWith('venue-2');
    expect(navigate).toHaveBeenCalledWith(['/home']);
  });

  it('does not navigate when the context rejects explicit confirmation', async () => {
    const query = new BehaviorSubject(convertToParamMap({ selectEstablishment: '1' }));
    const { fixture, host, context, navigate } = await mountShell({ query });
    context.confirm = vi.fn(() => false);
    const radio = host.querySelector('input[type="radio"]') as HTMLInputElement;
    radio.click();
    fixture.detectChanges();
    (host.querySelector('[data-testid="continue"]') as HTMLButtonElement).click();

    expect(navigate).not.toHaveBeenCalled();
    expect(host.querySelector('mapit-establishment-selector')).not.toBeNull();
  });

  it('keeps ordinary Home entry with an active context free of popup and refresh', async () => {
    const { host, context, navigate } = await mountShell();

    expect(host.querySelector('mapit-establishment-selector')).toBeNull();
    expect(context.load).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens first establishment setup only after the admin receives an empty list', async () => {
    const { fixture, host, context, navigateByUrl, router } = await mountShell({
      role: 'ADMIN',
      active: signal(null),
      establishments: [],
      status: signal('loading'),
    });
    expect(navigateByUrl).not.toHaveBeenCalled();

    context.status.set('ready');
    fixture.detectChanges();

    expect(navigateByUrl).toHaveBeenCalledExactlyOnceWith(
      router.parseUrl('/spaces/setup?manage=1'),
      { replaceUrl: true },
    );
    expect(host.querySelector('mapit-establishment-selector')).toBeNull();
  });

  it('renders the setup route without an active establishment for an admin', async () => {
    const { host, navigateByUrl } = await mountShell({
      role: 'ADMIN',
      active: signal(null),
      establishments: [],
      onSetup: true,
    });
    expect(host.querySelector('router-outlet')).not.toBeNull();
    expect(host.querySelector('mapit-establishment-selector')).toBeNull();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it.each([
    ['STAFF', 'ready'],
    ['ADMIN', 'error'],
  ] as const)('keeps the selector for %s with an empty list in state %s', async (role, status) => {
    const { host, navigateByUrl } = await mountShell({
      role,
      active: signal(null),
      establishments: [],
      status: signal(status),
    });
    expect(host.querySelector('mapit-establishment-selector')).not.toBeNull();
    expect(host.querySelector('router-outlet')).toBeNull();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('does not force a popup or redirect during ordinary entry confirmation', async () => {
    const { fixture, host, active, context, navigate } = await mountShell({
      active: signal<AccessibleEstablishment | null>(null),
    });
    expect(context.load).not.toHaveBeenCalled();
    expect(host.querySelector('mapit-establishment-selector')).not.toBeNull();
    const radio = host.querySelector('input[type="radio"]') as HTMLInputElement;
    radio.click();
    fixture.detectChanges();
    (host.querySelector('[data-testid="continue"]') as HTMLButtonElement).click();

    expect(active()).toEqual(ESTABLISHMENTS[0]);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('dismisses an explicit refresh to the previous validated establishment, not the candidate', async () => {
    const query = new BehaviorSubject(convertToParamMap({ selectEstablishment: '1' }));
    const { fixture, host, active, context, navigate } = await mountShell({ query });
    expect(active()).toBeNull();
    expect(host.querySelector<HTMLButtonElement>('.dismiss-button')).not.toBeNull();

    host.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1]!.click();
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('.dismiss-button')!.click();

    expect(context.confirm).toHaveBeenCalledWith('venue-1');
    expect(active()).toEqual(ESTABLISHMENTS[0]);
    expect(navigate).toHaveBeenCalledWith(['/home']);
  });

  it('does not allow dismissing when the previous establishment was revoked', async () => {
    const query = new BehaviorSubject(convertToParamMap({ selectEstablishment: '1' }));
    const { fixture, host, context, navigate } = await mountShell({ query });
    context.establishments.set([ESTABLISHMENTS[1]!]);
    fixture.detectChanges();

    const cancel = new Event('cancel', { cancelable: true });
    host.querySelector('dialog')!.dispatchEvent(cancel);
    fixture.detectChanges();
    expect(cancel.defaultPrevented).toBe(true);
    expect(host.querySelector('.dismiss-button')).toBeNull();
    expect(context.confirm).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('allows a direct optional request after the restored active ID is revalidated', async () => {
    const query = new BehaviorSubject(convertToParamMap({ selectEstablishment: '1' }));
    const { fixture, host, active, context, navigate } = await mountShell({
      query,
      active: signal<AccessibleEstablishment | null>(null),
    });
    active.set(ESTABLISHMENTS[0]!);
    fixture.detectChanges();
    expect(host.querySelector('.dismiss-button')).not.toBeNull();

    host.querySelector<HTMLButtonElement>('.dismiss-button')!.click();
    expect(context.confirm).toHaveBeenCalledWith('venue-1');
    expect(navigate).toHaveBeenCalledWith(['/home']);
  });

  it('does not render a dismiss control for the mandatory initial selector', async () => {
    const { host } = await mountShell({ active: signal<AccessibleEstablishment | null>(null) });
    expect(host.querySelector('mapit-establishment-selector')).not.toBeNull();
    expect(host.querySelector('.dismiss-button')).toBeNull();
  });

  it('does not reuse the previous selection after the session identity changes', async () => {
    const query = new BehaviorSubject(convertToParamMap({ selectEstablishment: '1' }));
    const { fixture, host, user, context } = await mountShell({ query });
    context.status.set('loading');
    user.update((current) => ({ ...current, id: 'staff-2' }));
    fixture.detectChanges();
    context.status.set('ready');
    fixture.detectChanges();
    expect(host.querySelector('.dismiss-button')).toBeNull();
    expect(host.querySelector('router-outlet')).toBeNull();
  });
});
