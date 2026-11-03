import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nService, LANGUAGE_STORAGE_KEY, provideI18n } from './language';

describe('I18nService', () => {
  let i18n: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideI18n()] });
    i18n = TestBed.inject(I18nService);
    i18n.initialize();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('uses Spanish as the default and updates the document language', () => {
    expect(i18n.language()).toBe('es');
    expect(i18n.locale()).toBe('es-BO');
    expect(document.documentElement.lang).toBe('es');
  });

  it.each([
    ['es', 'es-BO'],
    ['en', 'en-US'],
    ['ja-JP', 'ja-JP'],
  ])('restores a saved supported locale %s', (language, locale) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    i18n.initialize();

    expect(i18n.language()).toBe(language);
    expect(i18n.locale()).toBe(locale);
  });

  it('falls back to Spanish for an unsupported stored locale', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'zh-CN');
    i18n.initialize();

    expect(i18n.language()).toBe('es');
    expect(document.documentElement.lang).toBe('es');
  });

  it('persists a supported selection and rejects unsupported values', () => {
    localStorage.setItem('mapit.auth.tenant', 'tenant-demo');
    localStorage.setItem('mapit.auth.session', '{"tenantSlug":"tenant-demo"}');

    expect(i18n.setLanguage('ja-JP')).toBe(true);
    expect(i18n.language()).toBe('ja-JP');
    expect(i18n.locale()).toBe('ja-JP');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ja-JP');
    expect(document.documentElement.lang).toBe('ja-JP');
    expect(i18n.setLanguage('zh-CN')).toBe(false);
    expect(localStorage.getItem('mapit.auth.tenant')).toBe('tenant-demo');
    expect(localStorage.getItem('mapit.auth.session')).toBe('{"tenantSlug":"tenant-demo"}');
  });

  it('keeps the selected locale for the current page when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage disabled', 'SecurityError');
    });

    expect(i18n.setLanguage('en')).toBe(true);
    expect(i18n.language()).toBe('en');
  });
});
