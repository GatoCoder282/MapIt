import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import type { CustomerReservationHistoryItem } from '@mapit/api-client';

import { CustomerHistoryStore, type HistorySection } from '../model/customer-history-store';
import { MyReservationsPage } from './my-reservations-page';

const EMPTY: HistorySection = { items: [], status: 'idle', hasMore: false };
const entry = (
  status: CustomerReservationHistoryItem['status'],
  id: string,
): CustomerReservationHistoryItem => ({
  id,
  establishmentId: '20000000-0000-0000-0000-000000000001',
  establishmentName: 'La Bahía',
  spaceElementIds: ['30000000-0000-0000-0000-000000000001'],
  startsAt: '2026-10-26T03:30:00Z',
  endsAt: '2026-10-26T04:30:00Z',
  timezone: 'America/La_Paz',
  status,
  createdAt: '2026-10-25T12:00:00Z',
});

describe('MyReservationsPage', () => {
  let store: {
    tenantSlug: ReturnType<typeof signal<string>>;
    email: ReturnType<typeof signal<string>>;
    emailError: ReturnType<typeof signal<string>>;
    requestStatus: ReturnType<typeof signal<'idle' | 'loading' | 'sent' | 'error'>>;
    exchangeStatus: ReturnType<typeof signal<'idle' | 'loading' | 'invalid'>>;
    errorMessage: ReturnType<typeof signal<string>>;
    sessionNotice: ReturnType<typeof signal<string>>;
    sessionActive: ReturnType<typeof signal<boolean>>;
    upcoming: ReturnType<typeof signal<HistorySection>>;
    past: ReturnType<typeof signal<HistorySection>>;
    setTenant: ReturnType<typeof vi.fn>;
    exchange: ReturnType<typeof vi.fn>;
    setEmail: ReturnType<typeof vi.fn>;
    requestAccess: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    store = {
      tenantSlug: signal('demo'),
      email: signal(''),
      emailError: signal(''),
      requestStatus: signal('idle'),
      exchangeStatus: signal('idle'),
      errorMessage: signal(''),
      sessionNotice: signal(''),
      sessionActive: signal(false),
      upcoming: signal(EMPTY),
      past: signal(EMPTY),
      setTenant: vi.fn(),
      exchange: vi.fn(),
      setEmail: vi.fn(),
      requestAccess: vi.fn(),
      load: vi.fn(),
      logout: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.overrideComponent(MyReservationsPage, {
      set: { providers: [{ provide: CustomerHistoryStore, useValue: store }] },
    });
    await TestBed.compileComponents();
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
    TestBed.resetTestingModule();
  });

  async function render(): Promise<ComponentFixture<MyReservationsPage>> {
    const fixture = TestBed.createComponent(MyReservationsPage);
    fixture.componentRef.setInput('tenantSlug', 'demo');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('borra el fragmento antes de iniciar el canje y mantiene el acceso por correo', async () => {
    window.history.replaceState(null, '', '/mis-reservas/demo#token=solo-en-memoria');
    store.exchange.mockImplementation(() => {
      expect(window.location.hash).toBe('');
    });
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    expect(store.exchange).toHaveBeenCalledWith('solo-en-memoria');
    expect(window.location.href).not.toContain('token=');
    expect(root.querySelector('input[type=email]')).toBeTruthy();
    expect(root.textContent).not.toContain('Si el correo está registrado');
  });

  it('también canjea enlaces abiertos en la misma pestaña sin remontar el componente', async () => {
    await render();
    window.history.replaceState(null, '', '/mis-reservas/demo#token=segundo-enlace');
    window.dispatchEvent(new Event('hashchange'));
    expect(window.location.hash).toBe('');
    expect(store.exchange).toHaveBeenCalledWith('segundo-enlace');
  });

  it('muestra cinco estados, cancelada futura y ambos días en la zona IANA', async () => {
    store.sessionActive.set(true);
    store.upcoming.set({
      status: 'loaded',
      hasMore: true,
      items: [entry('CANCELLED', '1'), entry('CONFIRMED', '2'), entry('ACTIVE', '3')],
    });
    store.past.set({
      status: 'loaded',
      hasMore: false,
      items: [entry('CREATED', '4'), entry('RELEASED', '5')],
    });
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    for (const label of ['Cancelada', 'Confirmada', 'En curso', 'Creada', 'Finalizada']) {
      expect(text).toContain(label);
    }
    expect(text).toContain('25 de octubre');
    expect(text).toContain('26 de octubre');
    expect(text).toContain('America/La_Paz');
    expect(root.querySelectorAll('.period')[0]?.textContent).toContain('Cancelada');
    expect(root.querySelectorAll('.period')[1]?.textContent).not.toContain('Cancelada');
    expect(root.querySelectorAll('.reservation')).toHaveLength(5);
  });

  it('distingue vacío de error y permite reintentar o cargar más por sección', async () => {
    store.sessionActive.set(true);
    store.upcoming.set({ status: 'error', items: [], hasMore: false });
    store.past.set({ status: 'loaded', items: [], hasMore: false });
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('[role=alert]')).toHaveLength(1);
    expect(root.textContent).toContain('Todavía no hay reservas pasadas');
    const retry = root.querySelector('.period .secondary') as HTMLButtonElement;
    retry.click();
    expect(store.load).toHaveBeenCalledWith('upcoming', false);
    store.upcoming.set({ status: 'loaded', items: [entry('CANCELLED', '1')], hasMore: true });
    fixture.detectChanges();
    (root.querySelector('.load-more') as HTMLButtonElement).click();
    expect(store.load).toHaveBeenCalledWith('upcoming', true);
  });
});
