import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BASE_PATH } from '@mapit/api-client';
import { LoginApi } from './login-api';

describe('LoginApi', () => {
  it('usa el contrato y la URL de configuración sin enviar Bearer', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: 'http://localhost:8080/api/v1' },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const body = { tenantSlug: 'demo', email: 'demo@example.com', password: ' exacta ' };
    TestBed.inject(LoginApi).login(body).subscribe();
    const request = http.expectOne('http://localhost:8080/api/v1/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.transferCache).toBe(false);
    request.flush({});
    http.verify();
  });
});
