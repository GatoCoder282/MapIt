import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { I18nService, provideI18n } from '@mapit/i18n';
import { HowItWorks } from './how-it-works';
describe('Cómo funciona', () => {
  it('enlaza las seis etapas y traduce el contenido sin añadir controles de operación', () => {
    TestBed.configureTestingModule({
      imports: [HowItWorks],
      providers: [provideRouter([]), provideI18n()],
    });
    const language = TestBed.inject(I18nService);
    language.initialize();
    language.setLanguage('es');
    const fixture = TestBed.createComponent(HowItWorks);
    try {
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelectorAll('h1')).toHaveLength(1);
      expect(root.querySelectorAll('.process-section')).toHaveLength(6);
      const links = [...root.querySelectorAll<HTMLAnchorElement>('.journey a')];
      expect(links).toHaveLength(6);
      for (const link of links)
        expect(root.querySelector(link.getAttribute('href')!)).not.toBeNull();
      expect(root.querySelector('.hero-actions .primary')?.getAttribute('href')).toBe('#proceso');
      expect(root.querySelector('.how-cta a')?.getAttribute('href')).toBe('/negocios');
      expect(root.querySelector('.hero-actions .secondary')?.getAttribute('href')).toBe(
        '/negocios',
      );
      expect(root.querySelectorAll('form,input,select,button')).toHaveLength(0);
      expect(root.textContent).not.toMatch(/mockup|vista ilustrativa|en desarrollo|demo/i);
      expect(root.querySelector('.receipt-phone')?.textContent).toContain(
        'cuando se confirma el pago',
      );
      language.setLanguage('en');
      fixture.detectChanges();
      expect(root.querySelector('h1')?.textContent).toContain('real-time operations');
      expect(root.querySelector('.lookup-phone')?.textContent).toContain('Reception and check-in');
      language.setLanguage('ja-JP');
      fixture.detectChanges();
      expect(root.querySelector('h1')?.textContent).toContain('リアルタイム');
      expect(root.querySelector('.setup-panel')?.textContent).toContain('施設を新規登録');
    } finally {
      language.setLanguage('es');
      fixture.destroy();
      TestBed.resetTestingModule();
    }
  });
});
