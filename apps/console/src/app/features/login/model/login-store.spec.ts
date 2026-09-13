import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, Subject, type Observable } from 'rxjs';
import { type LoginResponse } from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { LoginApi } from '../data/login-api';
import { HttpErrorResponse } from '@angular/common/http';
import { LoginStore } from './login-store';

describe('LoginStore', () => {
  const response = new Subject<LoginResponse>();
  const login = vi.fn<() => Observable<LoginResponse>>(() => response);
  const start = vi.fn();
  const navigateByUrl = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
  });
  function create(tenant = 'empresa-prueba'): LoginStore {
    const paramMap = convertToParamMap(tenant ? { tenantSlug: tenant } : {});
    TestBed.configureTestingModule({
      providers: [
        LoginStore,
        { provide: LoginApi, useValue: { login } },
        { provide: AuthSession, useValue: { start } },
        { provide: Router, useValue: { navigateByUrl } },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(paramMap),
            snapshot: { paramMap },
          },
        },
      ],
    });
    return TestBed.inject(LoginStore);
  }

  it('valida campos vacíos y corrige el correo después del intento', () => {
    const store = create();
    expect(store.emailError()).toBe('');
    store.submit();
    expect(store.emailError()).toBeTruthy();
    expect(store.passwordError()).toBeTruthy();
    store.setEmail('invalido');
    expect(store.emailError()).toContain('válido');
    store.setEmail('persona@empresa.com');
    expect(store.emailError()).toBe('');
  });

  it('conserva la contraseña exacta al alternar visibilidad y recordar', () => {
    const store = create();
    store.setPassword('  contraseña original  ');
    store.togglePassword();
    store.toggleRemember();
    expect(store.passwordVisible()).toBe(true);
    expect(store.remember()).toBe(true);
    expect(store.password()).toBe('  contraseña original  ');
  });

  it('normaliza correo, conserva contraseña y evita envíos duplicados', () => {
    const store = create();
    store.setEmail(' PERSONA@empresa.com ');
    store.setPassword(' clave ');
    store.submit();
    store.submit();
    expect(login).toHaveBeenCalledExactlyOnceWith({
      tenantSlug: 'empresa-prueba',
      email: 'persona@empresa.com',
      password: ' clave ',
    });
    expect(store.pending()).toBe(true);
  });

  it('establece sesión, limpia contraseña y navega al inicio', () => {
    login.mockReturnValueOnce(of({ accessToken: 'token' } as LoginResponse));
    const store = create();
    store.setEmail('persona@empresa.com');
    store.setPassword('clave');
    store.toggleRemember();
    store.submit();
    expect(start).toHaveBeenCalledWith({ accessToken: 'token' }, 'empresa-prueba', true);
    expect(store.password()).toBe('');
    expect(navigateByUrl).toHaveBeenCalledWith('/home');
    expect(store.pending()).toBe(false);
  });

  it('permite reintentar tras 401 sin mostrar detalles del servidor', () => {
    const rejected = new Subject<LoginResponse>();
    login.mockReturnValueOnce(rejected);
    const store = create();
    store.setEmail('persona@empresa.com');
    store.setPassword('clave');
    store.submit();
    rejected.error(new HttpErrorResponse({ status: 401, error: { detail: 'privado' } }));
    expect(store.message()).toBe('Credenciales inválidas.');
    expect(store.pending()).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });

  it('distingue problemas de conexión de credenciales rechazadas', () => {
    const rejected = new Subject<LoginResponse>();
    login.mockReturnValueOnce(rejected);
    const store = create();
    store.setEmail('persona@empresa.com');
    store.setPassword('clave');
    store.submit();
    rejected.error(new HttpErrorResponse({ status: 0 }));
    expect(store.message()).toContain('conectar con el servicio');
    expect(store.pending()).toBe(false);
  });

  it('no utiliza un tenant por defecto si falta el enlace de empresa', () => {
    const store = create('');
    store.setEmail('persona@empresa.com');
    store.setPassword('clave');
    store.submit();
    expect(store.tenantSlug()).toBe('');
    expect(store.message()).toContain('enlace de acceso');
  });
});
