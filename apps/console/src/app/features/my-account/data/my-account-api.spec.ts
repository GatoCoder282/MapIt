import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BASE_PATH } from '@mapit/api-client';
import { MyAccountApi } from './my-account-api';

describe('MyAccountApi', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: '/api/v1' },
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('consulta el perfil propio con el cliente generado, sin selector de identidad', () => {
    const received = vi.fn();
    TestBed.inject(MyAccountApi).read().subscribe(received);
    const request = TestBed.inject(HttpTestingController).expectOne('/api/v1/me');
    expect(request.request.method).toBe('GET');
    expect(request.request.transferCache).toBe(false);
    request.flush({ fullName: 'Nombre real', email: 'real@example.com' });
    expect(received).toHaveBeenCalledWith({ fullName: 'Nombre real', email: 'real@example.com' });
  });

  it('envía únicamente fullName a PATCH /me', () => {
    TestBed.inject(MyAccountApi).updateName('Nuevo nombre').subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/v1/me');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ fullName: 'Nuevo nombre' });
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ fullName: 'Nuevo nombre', email: 'real@example.com' });
  });
});
