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
    session.start({ ...response(), password: 'never-store' } as SessionResponse, 'demo', false);
    expect(sessionStorage.getItem('mapit.auth.session')).toContain('Staff');
    expect(sessionStorage.getItem('mapit.auth.session')).not.toContain('never-store');
    expect(localStorage.getItem('mapit.auth.session')).toBeNull();
    session.start(response(), 'demo', true);
    expect(sessionStorage.getItem('mapit.auth.session')).toBeNull();
    expect(localStorage.getItem('mapit.auth.session')).toContain('Staff');
  });

  it('acepta un identificador de empresa diferente de su slug', () => {
    const session = TestBed.inject(AuthSession);
    const data = response();
    data.user.tenantId = 'Tenant_01';
    session.start(data, 'demo', false);
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
    session.start(response(), 'demo', true);
    vi.advanceTimersByTime(60_000);
    expect(session.user()).toBeNull();
    expect(localStorage.getItem('mapit.auth.session')).toBeNull();
    expect(vi.mocked(TestBed.inject(Router)).navigateByUrl.mock.calls[0]?.[0]).toBe(
      '/empresa/demo/login',
    );
  });

  it('comprueba expiración aunque no se haya ejecutado el temporizador', () => {
    const session = TestBed.inject(AuthSession);
    session.start(response(), 'demo', false);
    vi.setSystemTime(Date.now() + 60_001);
    expect(session.token()).toBeNull();
  });

  it('no acepta respuestas inválidas y conserva la sesión actual', () => {
    const session = TestBed.inject(AuthSession);
    session.start(response(), 'demo', false);
    expect(() => session.start({ ...response(), expiresAt: 'invalid' }, 'demo', false)).toThrow();
    expect(session.token()).toBe('header.payload.signature');
  });

  it('ofrece sesión en memoria cuando el almacenamiento falla', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const session = TestBed.inject(AuthSession);
    session.start(response(), 'demo', true);
    expect(session.token()).toBeTruthy();
    expect(session.warning()).toContain('no permite guardarla');
  });

  it('guard requiere sesión y cierre conserva únicamente la empresa', () => {
    const session = TestBed.inject(AuthSession);
    const runGuard = () => TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect((runGuard() as UrlTree).toString()).toBe('/login');
    session.start(response(), 'demo', false);
    expect(runGuard()).toBe(true);
    session.logout();
    expect((runGuard() as UrlTree).toString()).toBe('/empresa/demo/login');
    expect(sessionStorage.getItem('mapit.auth.session')).toBeNull();
  });
});
