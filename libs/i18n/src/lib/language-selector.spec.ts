import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { LanguageSelector } from './language-selector';
import { I18nService, LANGUAGE_STORAGE_KEY, provideI18n } from './language';

describe('LanguageSelector', () => {
  it('selects a supported preference restored before the options render', () => {
    localStorage.clear();
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'ja-JP');
    TestBed.configureTestingModule({
      imports: [LanguageSelector],
      providers: [provideI18n()],
    });
    const i18n = TestBed.inject(I18nService);
    i18n.initialize();
    const fixture = TestBed.createComponent(LanguageSelector);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const select = host.querySelector<HTMLSelectElement>('select');
    if (!select) throw new Error('Language selector did not render its native select.');
    expect(i18n.language()).toBe('ja-JP');
    expect(select.value).toBe('ja-JP');

    fixture.destroy();
    TestBed.resetTestingModule();
  });

  it('shows native language names and changes the persisted locale', () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [LanguageSelector],
      providers: [provideI18n()],
    });
    const i18n = TestBed.inject(I18nService);
    i18n.initialize();
    const fixture = TestBed.createComponent(LanguageSelector);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const select = host.querySelector<HTMLSelectElement>('select');
    if (!select) throw new Error('Language selector did not render its native select.');
    expect(Array.from(select.options, (option) => option.value)).toEqual(['es', 'en', 'ja-JP']);
    expect(select.getAttribute('aria-label')).toBe('Idioma');

    select.value = 'ja-JP';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(i18n.language()).toBe('ja-JP');
    expect(select.value).toBe('ja-JP');
    expect(select.getAttribute('aria-label')).toBe('言語');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ja-JP');

    fixture.destroy();
    TestBed.resetTestingModule();
  });
});
