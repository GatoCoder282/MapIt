import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_API_URL, authInterceptor } from './auth-interceptor';
import { AuthSession } from './auth-session';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let session: AuthSession;
  const start = (token: string) =>
    session.start(
      {
        accessToken: token,
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          tenantId: 'demo',
          email: 'staff@example.com',
          fullName: 'Staff',
          role: 'STAFF',
        },
      },
      'demo',
      false,
    );
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTH_API_URL, useValue: () => 'http://localhost:8080/api/v1' },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSession);
    start('header.old.signature');
  });
  afterEach(() => {
    controller.verify();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it.each([
    ['http://localhost:8080/api/v1/items', true],
    ['http://localhost:8080/api/v1', true],
    ['http://localhost:8080/api/v10/items', false],
    ['http://localhost:8080/api/v1/auth/login?next=home', false],
    ['http://localhost:8080/api/v1/auth/login/', false],
    ['http://evil.example/api/v1/items', false],
    ['http://localhost:4242/api/v1/items', false],
    ['/assets/config.json', false],
    ['http://localhost:8080/api/v1/../private', false],
  ])('limita Bearer para %s', (url, attached) => {
    http.get(url).subscribe();
    const request = controller.expectOne(url);
    expect(request.request.headers.has('Authorization')).toBe(attached);
    request.flush({});
  });

  it('un 401 tardío no elimina una sesión nueva', () => {
    http.get('http://localhost:8080/api/v1/items').subscribe({ error: () => undefined });
    const request = controller.expectOne('http://localhost:8080/api/v1/items');
    start('header.new.signature');
    request.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(session.token()).toBe('header.new.signature');
  });

  it.each([401, 403])('maneja %i de la sesión actual', (status) => {
    http.get('http://localhost:8080/api/v1/items').subscribe({ error: () => undefined });
    controller
      .expectOne('http://localhost:8080/api/v1/items')
      .flush({}, { status, statusText: 'Rejected' });
    expect(session.token()).toBe(status === 401 ? null : 'header.old.signature');
  });
});
