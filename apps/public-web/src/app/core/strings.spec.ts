import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { I18nService, provideI18n } from '@mapit/i18n';
import { localizeString, STRINGS } from './strings';

describe('Public Web string catalogs', () => {
  let i18n: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideI18n()] });
    i18n = TestBed.inject(I18nService);
    i18n.initialize();
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('switches booking strings and re-localizes an error captured in Japanese', () => {
    expect(STRINGS.booking.submit).toBe('Crear reserva');
    i18n.setLanguage('ja-JP');
    const capturedError = STRINGS.booking.errors.generic;
    expect(capturedError).not.toBe(
      'No pudimos confirmar la reserva. Revisa tu conexión e inténtalo de nuevo.',
    );

    i18n.setLanguage('en');

    expect(STRINGS.booking.submit).toBe('Create reservation');
    expect(localizeString(capturedError)).toBe(STRINGS.booking.errors.generic);
  });
});
