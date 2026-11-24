import { TestBed } from '@angular/core/testing';
import { Router, type UrlTree, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession, type SessionResponse } from './auth-session';
import { authGuard } from './auth-guard';

const response = (): SessionResponse => ({
  accessToken: 'header.payload.signature',
  tokenType: 'Bearer',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    tenantId: 'demo',
    email: 'staff@example.com',
    fullName: 'Staff',
    role: 'STAFF',
  },
});

describe('AuthSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('guarda solo la sesión mínima y cambia Recordarme sin duplicados', () => {
    const session = TestBed.inject(AuthSession);
    session.start({ ...response(), password: 'never-store' } as SessionResponse, false);
    expect(sessionStorage.getItem('mapit.auth.session')).toContain('Staff');
    expect(sessionStorage.getItem('mapit.auth.session')).not.toContain('never-store');
    expect(localStorage.getItem('mapit.auth.session')).toBeNull();
    session.start(response(), true);
    expect(sessionStorage.getItem('mapit.auth.session')).toBeNull();
    expect(localStorage.getItem('mapit.auth.session')).toContain('Staff');
  });

  it('restaura una sesión guardada y vuelve a /login al expirar', () => {
    localStorage.setItem('mapit.auth.session', JSON.stringify({ ...response() }));
    const session = TestBed.inject(AuthSession);
    expect(session.loginUrl()).toBe('/login');
    expect(session.token()).toBeTruthy();
    vi.advanceTimersByTime(60_000);
    expect(vi.mocked(TestBed.inject(Router)).navigateByUrl.mock.calls[0]?.[0]).toBe('/login');
    expect(localStorage.getItem('mapit.auth.session')).toBeNull();
  });

  it('acepta un identificador de empresa diferente de su slug', () => {
    const session = TestBed.inject(AuthSession);
    const data = response();
    data.user.tenantId = 'Tenant_01';
    session.start(data, false);
    expect(session.user()?.tenantId).toBe('Tenant_01');
  });

  it('restaura una sesión válida', () => {
    localStorage.setItem(
      'mapit.auth.session',
      JSON.stringify({ ...response(), tenantSlug: 'demo' }),
    );
    expect(TestBed.inject(AuthSession).user()?.fullName).toBe('Staff');
  });

  it.each([
    '{',
    JSON.stringify({ accessToken: 'broken' }),
    JSON.stringify({ ...response(), expiresAt: '2000-01-01', tenantSlug: 'demo' }),
  ])('descarta almacenamiento corrupto o vencido: %s', (stored) => {
    sessionStorage.setItem('mapit.auth.session', stored);
    expect(TestBed.inject(AuthSession).token()).toBeNull();
    expect(sessionStorage.getItem('mapit.auth.session')).toBeNull();
  });

  it('expira y vuelve al login de empresa eliminando persistencia', () => {
    const session = TestBed.inject(AuthSession);
    session.start(response(), true);
    vi.advanceTimersByTime(60_000);
    expect(session.user()).toBeNull();
    expect(localStorage.getItem('mapit.auth.session')).toBeNull();
    expect(vi.mocked(TestBed.inject(Router)).navigateByUrl.mock.calls[0]?.[0]).toBe('/login');
  });

  it('comprueba expiración aunque no se haya ejecutado el temporizador', () => {
    const session = TestBed.inject(AuthSession);
    session.start(response(), false);
    vi.setSystemTime(Date.now() + 60_001);
    expect(session.token()).toBeNull();
  });

  it('no acepta respuestas inválidas y conserva la sesión actual', () => {
    const session = TestBed.inject(AuthSession);
    session.start(response(), false);
    expect(() => session.start({ ...response(), expiresAt: 'invalid' }, false)).toThrow();
    expect(session.token()).toBe('header.payload.signature');
  });

  it('ofrece sesión en memoria cuando el almacenamiento falla', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const session = TestBed.inject(AuthSession);
    session.start(response(), true);
    expect(session.token()).toBeTruthy();
    expect(session.warning()).toContain('no permite guardarla');
  });

  it('guard requiere sesión y cierre conserva únicamente la empresa', () => {
    const session = TestBed.inject(AuthSession);
    const runGuard = () => TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect((runGuard() as UrlTree).toString()).toBe('/login');
    session.start(response(), false);
    expect(runGuard()).toBe(true);
    session.logout();
    expect((runGuard() as UrlTree).toString()).toBe('/login');
    expect(sessionStorage.getItem('mapit.auth.session')).toBeNull();
  });

  it.each([false, true])(
    'actualiza solo nombre y conserva token, expiración y almacenamiento (remember=%s)',
    (remember) => {
      const session = TestBed.inject(AuthSession);
      const original = response();
      session.start(original, remember);
      const revision = session.revision();
      expect(session.updateFullName('Nombre confirmado', revision)).toBe(true);
      expect(session.token()).toBe(original.accessToken);
      expect(session.revision()).toBe(revision);
      expect(session.user()).toEqual({ ...original.user, fullName: 'Nombre confirmado' });
      const chosen = remember ? localStorage : sessionStorage;
      const other = remember ? sessionStorage : localStorage;
      expect(JSON.parse(chosen.getItem('mapit.auth.session')!)).toEqual({
        ...original,
        user: { ...original.user, fullName: 'Nombre confirmado' },
      });
      expect(other.getItem('mapit.auth.session')).toBeNull();
      vi.advanceTimersByTime(60_000);
      expect(session.user()).toBeNull();
    },
  );

  it('no aplica una respuesta de una sesión anterior aunque la identidad y JWT coincidan', () => {
    const session = TestBed.inject(AuthSession);
    const original = response();
    session.start(original, false);
    const revision = session.revision();
    session.logout();
    session.start(original, false);
    expect(session.updateFullName('Respuesta antigua', revision)).toBe(false);
    expect(session.user()?.fullName).toBe('Staff');
  });

  it('conserva el almacén de una sesión restaurada al actualizar nombre', () => {
    localStorage.setItem('mapit.auth.session', JSON.stringify(response()));
    const session = TestBed.inject(AuthSession);
    expect(session.updateFullName('Restaurado', session.revision())).toBe(true);
    expect(localStorage.getItem('mapit.auth.session')).toContain('Restaurado');
    expect(sessionStorage.getItem('mapit.auth.session')).toBeNull();
  });

  it('rechaza nombre inválido y respuestas después del logout o expiración', () => {
    const session = TestBed.inject(AuthSession);
    session.start(response(), false);
    for (const name of ['', ' ', ' nombre', 'nombre ', 'dos\nlineas', 'a'.repeat(121)]) {
      expect(session.updateFullName(name, session.revision())).toBe(false);
    }
    vi.setSystemTime(Date.now() + 60_001);
    expect(session.updateFullName('Tardío', session.revision())).toBe(false);
    expect(session.user()).toBeNull();
  });

  it('mantiene el nombre confirmado en memoria y avisa si falla la persistencia local', () => {
    const session = TestBed.inject(AuthSession);
    session.start(response(), false);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(session.updateFullName('Confirmado', session.revision())).toBe(true);
    expect(session.user()?.fullName).toBe('Confirmado');
    expect(session.warning()).toBeTruthy();
  });
});
