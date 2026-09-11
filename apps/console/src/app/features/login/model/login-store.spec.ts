import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { LoginStore } from './login-store';

describe('LoginStore', () => {
  function create(tenant = 'empresa-prueba'): LoginStore {
    const paramMap = convertToParamMap(tenant ? { tenantSlug: tenant } : {});
    TestBed.configureTestingModule({
      providers: [
        LoginStore,
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

  it('obtiene la empresa de la ruta sin simular una sesión', () => {
    const store = create();
    store.setEmail('persona@empresa.com');
    store.setPassword('clave');
    store.submit();
    expect(store.tenantSlug()).toBe('empresa-prueba');
    expect(store.message()).toContain('próximamente');
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
