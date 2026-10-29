import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { I18nService, provideI18n } from '@mapit/i18n';
import { localizeString, STRINGS } from './strings';

describe('Console string catalogs', () => {
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

  it('switches interface strings while keeping vertical labels independent', () => {
    expect(STRINGS.shell.logout).toBe('Cerrar sesión');
    expect(STRINGS.verticals.RESTAURANT).toBe('Restaurante');

    i18n.setLanguage('en');
    expect(STRINGS.shell.logout).toBe('Sign out');
    expect(STRINGS.verticals.RESTAURANT).toBe('Restaurante');

    i18n.setLanguage('ja-JP');
    expect(STRINGS.shell.logout).toBe('サインアウト');
    expect(STRINGS.verticals.RESTAURANT).toBe('Restaurante');
  });

  it('re-localizes an error captured before the language changes', () => {
    i18n.setLanguage('ja-JP');
    const capturedError = STRINGS.audit.error;

    i18n.setLanguage('en');

    expect(localizeString(capturedError)).toBe(STRINGS.audit.error);
  });
});
