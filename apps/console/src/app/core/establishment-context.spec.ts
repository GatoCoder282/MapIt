import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AccessibleEstablishment } from '@mapit/api-client';
import type { SessionUser } from '@mapit/auth';
import { EstablishmentsService } from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { Subject, of, throwError } from 'rxjs';
import { EstablishmentContext } from './establishment-context';

const A: AccessibleEstablishment = {
  id: 'est-a',
  name: 'Establecimiento A',
  slug: 'establecimiento-a',
  address: 'Calle 1',
  timezone: 'America/La_Paz',
  canManagePayments: false,
  canCheckIn: false,
};
const B: AccessibleEstablishment = { ...A, id: 'est-b', name: 'Establecimiento B' };
const USER: SessionUser = {
  id: 'user-a',
  tenantId: 'tenant-a',
  email: 'staff@example.test',
  fullName: 'Staff',
  role: 'STAFF',
};

describe('EstablishmentContext', () => {
  let context: EstablishmentContext;
  let user: ReturnType<typeof signal<SessionUser | null>>;
  const list = vi.fn(() => of([A, B]));

  function createContext(): void {
    user = signal<SessionUser | null>(USER);
    TestBed.configureTestingModule({
      providers: [
        EstablishmentContext,
        { provide: EstablishmentsService, useValue: { listAccessibleEstablishments: list } },
        { provide: AuthSession, useValue: { user: user.asReadonly() } },
      ],
    });
    context = TestBed.inject(EstablishmentContext);
    TestBed.flushEffects();
  }

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    list.mockReturnValue(of([A, B]));
    createContext();
  });

  afterEach(() => vi.restoreAllMocks());

  it('carga por identidad al entrar y queda lista sin autoelegir', async () => {
    await vi.waitFor(() => expect(context.status()).toBe('ready'));
    expect(list).toHaveBeenCalledOnce();
    expect(context.establishments()).toEqual([A, B]);
    expect(context.active()).toBeNull();
    expect(context.status()).toBe('ready');
  });

  it('reactualiza active si se lee antes del primer efecto', async () => {
    TestBed.resetTestingModule();
    user = signal<SessionUser | null>(USER);
    TestBed.configureTestingModule({
      providers: [
        EstablishmentContext,
        { provide: EstablishmentsService, useValue: { listAccessibleEstablishments: list } },
        { provide: AuthSession, useValue: { user: user.asReadonly() } },
      ],
    });
    context = TestBed.inject(EstablishmentContext);

    expect(context.active()).toBeNull();
    TestBed.flushEffects();
    await vi.waitFor(() => expect(context.status()).toBe('ready'));
    expect(context.confirm(A.id)).toBe(true);
    expect(context.active()).toEqual(A);
  });

  it('restaura solo la preferencia recordada que figura en la lista fresca', async () => {
    localStorage.setItem('mapit.establishment.tenant-a.user-a', 'est-b');
    TestBed.resetTestingModule();
    createContext();
    await context.load();
    expect(context.active()).toEqual(B);
    expect(localStorage.getItem('mapit.establishment.tenant-a.user-a')).toBe('est-b');
  });

  it('rechaza preferencia manipulada o revocada y no autoelige con un único local', async () => {
    localStorage.setItem('mapit.establishment.tenant-a.user-a', 'not-authorized');
    list.mockReturnValue(of([A]));
    TestBed.resetTestingModule();
    createContext();
    await context.load();
    expect(context.active()).toBeNull();
    expect(context.confirm('not-authorized')).toBe(false);
    expect(localStorage.getItem('mapit.establishment.tenant-a.user-a')).toBeNull();
  });

  it('deja una lista vacía seleccionable solo tras una carga correcta', async () => {
    list.mockReturnValue(of([]));
    TestBed.resetTestingModule();
    createContext();
    await context.load();
    expect(context.establishments()).toEqual([]);
    expect(context.status()).toBe('ready');
    expect(context.confirm('missing')).toBe(false);
  });

  it('reintenta una lista vacía y carga el resultado actualizado', async () => {
    list.mockReturnValue(of([]));
    TestBed.resetTestingModule();
    createContext();
    await vi.waitFor(() => expect(context.status()).toBe('ready'));
    expect(context.active()).toBeNull();

    list.mockReturnValue(of([A]));
    await context.load();
    expect(context.establishments()).toEqual([A]);
    expect(context.active()).toBeNull();
  });

  it('tolera que storage impida eliminar una preferencia no autorizada', async () => {
    localStorage.setItem('mapit.establishment.tenant-a.user-a', 'not-authorized');
    list.mockReturnValue(of([A]));
    TestBed.resetTestingModule();
    createContext();
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    await context.load();
    expect(context.status()).toBe('ready');
    expect(context.active()).toBeNull();
  });

  it('permite reintentar después de error', async () => {
    list.mockReturnValueOnce(throwError(() => new Error('network'))).mockReturnValueOnce(of([A]));
    TestBed.resetTestingModule();
    createContext();
    await context.load();
    expect(context.status()).toBe('error');
    await context.load();
    expect(context.status()).toBe('ready');
    expect(context.establishments()).toEqual([A]);
  });

  it('confirma en memoria aunque localStorage no permita escribir', async () => {
    await context.load();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(context.confirm(A.id)).toBe(true);
    expect(context.active()).toEqual(A);
  });

  it('invalida contexto al cambiar identidad y al cerrar sesión', async () => {
    await context.load();
    expect(context.confirm(A.id)).toBe(true);
    user.set({ ...USER, id: 'user-b' });
    TestBed.flushEffects();
    expect(context.active()).toBeNull();
    await context.load();
    expect(context.establishments()).toEqual([A, B]);
    user.set(null);
    TestBed.flushEffects();
    expect(context.establishments()).toEqual([]);
    expect(context.active()).toBeNull();
    expect(context.status()).toBe('idle');
  });

  it('descarta respuesta tardía si hubo logout y regreso a la misma identidad', async () => {
    const staleResponse = new Subject<AccessibleEstablishment[]>();
    const currentResponse = new Subject<AccessibleEstablishment[]>();
    TestBed.resetTestingModule();
    list.mockReturnValueOnce(staleResponse).mockReturnValue(currentResponse);
    createContext();
    const pending = context.load();
    user.set(null);
    TestBed.flushEffects();
    user.set(USER);
    TestBed.flushEffects();
    staleResponse.next([A]);
    staleResponse.complete();
    await pending;
    expect(context.establishments()).toEqual([]);
    expect(context.confirm(A.id)).toBe(false);
  });

  it('confirm valida sesión actual sin esperar a que corra el effect', async () => {
    await context.load();
    user.set({ ...USER, tenantId: 'tenant-b' });
    expect(context.confirm(A.id)).toBe(false);
  });

  it('invalida inmediatamente la misma identidad reautenticada y recarga en el effect', async () => {
    localStorage.setItem('mapit.establishment.tenant-a.user-a', A.id);
    list.mockReturnValueOnce(of([A])).mockReturnValue(of([B]));
    TestBed.resetTestingModule();
    createContext();
    await vi.waitFor(() => expect(context.active()).toEqual(A));

    user.set({ ...USER });
    expect(context.active()).toBeNull();
    expect(context.confirm(A.id)).toBe(false);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(context.establishments()).toEqual([B]));

    expect(list.mock.calls.length).toBeGreaterThan(1);
    expect(context.active()).toBeNull();
  });
});
