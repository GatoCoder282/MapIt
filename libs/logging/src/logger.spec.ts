import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger, logBootstrapFailure, provideLogging } from './logger';
import { type LogContext } from './catalog';

describe('logging JSON y privacidad', () => {
  const lines: string[] = [];
  beforeEach(() => {
    lines.length = 0;
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        lines.push(String(args[0]));
      });
    }
    TestBed.configureTestingModule({
      providers: [provideLogging({ service: 'mapit-console', environment: 'test' })],
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('emite únicamente el catálogo y contexto permitido incluso ante datos arbitrarios', () => {
    const error = new TypeError('password=private-canary', {
      cause: new Error('Bearer private-canary'),
    });
    error.stack = 'private-canary\n at https://private-canary/main.js?token=private-canary:12:34';
    TestBed.inject(Logger).log(
      'ERROR',
      'app.error.unhandled',
      {
        request_id: 'private-canary',
        method: 'private-canary',
        operation: 'private-canary',
        status: 500,
        duration_ms: 42,
        authorization: 'private-canary',
        body: { secret: 'private-canary' },
      } as unknown as LogContext,
      error,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('private-canary');
    const entry = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(entry).toMatchObject({
      level: 'ERROR',
      service: 'mapit-console',
      environment: 'test',
      status: 500,
      duration_ms: 42,
    });
    expect(entry['error_chain']).toEqual([
      { type: 'TypeError', frames: [{ line: 12, column: 34 }] },
      expect.objectContaining({ type: 'Error' }),
    ]);
    expect(entry['request_id']).toBeUndefined();
    expect(entry['body']).toBeUndefined();
  });

  it('diferencia niveles y permite configurar DEBUG y OFF sin aceptar un entorno arbitrario', () => {
    const logger = TestBed.inject(Logger);
    logger.log('DEBUG', 'http.request.completed');
    expect(lines).toHaveLength(0);
    logger.configure({ logLevel: 'DEBUG', environment: 'secret-canary' });
    logger.log('DEBUG', 'http.request.completed');
    expect(JSON.parse(lines[0]!) as unknown).toMatchObject({
      level: 'DEBUG',
      environment: 'unknown',
    });
    logger.configure({ logLevel: 'OFF' });
    logger.log('ERROR', 'app.error.unhandled');
    expect(lines).toHaveLength(1);
  });

  it('un mismo error no se duplica al llegar al manejador global', () => {
    const error = new Error('private-canary');
    TestBed.inject(Logger).report('WARN', 'http.request.failed', error, { status: 401 });
    TestBed.inject(ErrorHandler).handleError(error);
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('private-canary');
  });

  it('un error esperado suprimido no se eleva a ERROR en el manejador global', () => {
    const error = new Error('validación esperada');
    TestBed.inject(Logger).report('DEBUG', 'http.request.failed', error, { status: 400 });
    TestBed.inject(ErrorHandler).handleError(error);
    expect(lines).toHaveLength(0);
  });

  it('registra fallos anteriores al bootstrap sin depender del inyector', () => {
    TestBed.resetTestingModule();
    logBootstrapFailure('mapit-public-web', new Error('token=private-canary'));
    expect(JSON.parse(lines[0]!) as unknown).toMatchObject({
      event: 'app.bootstrap.failed',
      service: 'mapit-public-web',
    });
    expect(lines[0]).not.toContain('private-canary');
  });

  it('un getter de error defectuoso no interrumpe el flujo de diagnóstico', () => {
    const error = new Error();
    Object.defineProperty(error, 'stack', {
      get: () => {
        throw new Error('private-canary');
      },
    });
    expect(() => TestBed.inject(ErrorHandler).handleError(error)).not.toThrow();
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('private-canary');
  });
});
