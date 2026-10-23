import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOGGING_API_URL, loggingInterceptor } from './http-logging';
import { provideLogging } from './logger';

describe('correlación HTTP', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  const lines: string[] = [];
  const base = 'http://localhost:8080/api/v1';
  beforeEach(() => {
    lines.length = 0;
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        lines.push(String(args[0]));
      });
    }
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([loggingInterceptor])),
        provideHttpClientTesting(),
        provideLogging({ service: 'mapit-console', level: 'DEBUG' }),
        { provide: LOGGING_API_URL, useValue: () => base },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    controller.verify();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    '/assets/config.json',
    'http://localhost:3063/proxy',
    'https://other.test/api/v1/items',
    `${base}0/items`,
    `${base}/../private`,
  ])('no adjunta identificadores ni registra destinos fuera de API: %s', (url) => {
    http.get(url).subscribe();
    const request = controller.expectOne(url);
    expect(request.request.headers.has('X-Request-ID')).toBe(false);
    request.flush({});
    expect(lines).toHaveLength(0);
  });

  it('peticiones concurrentes y nuevas suscripciones reciben IDs distintos', () => {
    const call = http.get(`${base}/tenants`);
    call.subscribe();
    call.subscribe();
    const requests = controller.match(`${base}/tenants`);
    const ids = requests.map((request) => request.request.headers.get('X-Request-ID'));
    expect(new Set(ids).size).toBe(2);
    requests[1]!.flush({});
    requests[0]!.flush({});
    const records = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(records.map((entry) => entry['request_id'])).toEqual([ids[1], ids[0]]);
  });

  it('funciona en una tablet por HTTP aunque randomUUID no esté disponible', () => {
    const randomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
    vi.stubGlobal('crypto', { getRandomValues: randomValues });
    http.get(`${base}/tenants`).subscribe();
    const request = controller.expectOne(`${base}/tenants`);
    expect(request.request.headers.get('X-Request-ID')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    request.flush({});
  });

  it('conserva el ID válido de respuesta y propaga el error sin exponer datos', () => {
    const received = vi.fn();
    http
      .post(`${base}/auth/login?token=private-canary`, { password: 'private-canary' })
      .subscribe({ error: received });
    const request = controller.expectOne(`${base}/auth/login?token=private-canary`);
    const responseId = 'abcdef01-1234-5678-9012-abcdef012345';
    request.flush(
      { detail: 'private-canary' },
      {
        status: 401,
        statusText: 'private-canary',
        headers: { 'X-Request-ID': responseId.toUpperCase() },
      },
    );
    expect(received).toHaveBeenCalledOnce();
    expect(JSON.parse(lines[0]!) as unknown).toMatchObject({
      request_id: responseId,
      status: 401,
      level: 'WARN',
      operation: 'auth',
    });
    expect(lines.join('')).not.toContain('private-canary');
  });

  it('un fallo de red o respuesta sin ID válido conserva el identificador enviado', () => {
    http.get(`${base}/tenants`).subscribe({ error: () => undefined });
    const request = controller.expectOne(`${base}/tenants`);
    const id = request.request.headers.get('X-Request-ID');
    request.error(new ProgressEvent('error'));
    expect(JSON.parse(lines[0]!) as unknown).toMatchObject({
      request_id: id,
      status: 0,
      level: 'ERROR',
    });
  });
});
