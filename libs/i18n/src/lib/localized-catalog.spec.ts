import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { I18nService, provideI18n } from './language';
import { createLocalizedCatalog, createLocalizedTextResolver } from './localized-catalog';

const ES = {
  save: 'Guardar',
  nested: { cancel: 'Cancelar', retry: 'Reintentar' },
  states: ['Cargando', 'Listo'],
} as const;
const EN = {
  save: 'Save',
  nested: { cancel: 'Cancel', retry: 'Retry' },
  states: ['Loading', 'Ready'],
} as const;
const JA = {
  save: '保存',
  nested: { cancel: 'キャンセル' },
  states: ['読み込み中', '完了'],
} as const;
const CATALOGS = { es: ES, en: EN, 'ja-JP': JA } as const;
const strings = createLocalizedCatalog<typeof ES>(CATALOGS, 'es');
const localizeText = createLocalizedTextResolver(CATALOGS, 'es');

describe('localized catalogs', () => {
  let i18n: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideI18n()] });
    i18n = TestBed.inject(I18nService);
    i18n.initialize();
  });

  it('resolves nested values and arrays in the selected locale', () => {
    expect(strings.nested.cancel).toBe('Cancelar');

    i18n.setLanguage('en');
    expect(strings.nested.cancel).toBe('Cancel');
    expect(strings.states).toEqual(['Loading', 'Ready']);
  });

  it('uses the Spanish fallback for a missing translation', () => {
    i18n.setLanguage('ja-JP');

    expect(strings.nested.retry).toBe('Reintentar');
    expect(strings.save).toBe('保存');
  });

  it('translates a stored canonical message after the language changes', () => {
    const errorAtSubmission = 'Cancelar';
    expect(localizeText(errorAtSubmission)).toBe('Cancelar');

    i18n.setLanguage('en');
    expect(localizeText(errorAtSubmission)).toBe('Cancel');

    i18n.setLanguage('ja-JP');
    expect(localizeText('Cancel')).toBe('\u30ad\u30e3\u30f3\u30bb\u30eb');
    expect(localizeText('Reintentar')).toBe('Reintentar');
    expect(localizeText('Retry')).toBe('Reintentar');
  });
});
