import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { I18nService, provideI18n } from '@mapit/i18n';
import { About } from './about';
describe('Acerca de MapIt', () => {
  it('presenta las secciones de la referencia y cambia de idioma', () => {
    TestBed.configureTestingModule({
      imports: [About],
      providers: [provideRouter([]), provideI18n()],
    });
    const language = TestBed.inject(I18nService);
    language.initialize();
    language.setLanguage('es');
    const fixture = TestBed.createComponent(About);
    try {
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelectorAll('h1')).toHaveLength(1);
      expect(root.querySelector('#who-title')?.textContent).toContain('¿Quiénes somos?');
      expect(root.querySelectorAll('.goals li')).toHaveLength(3);
      expect(root.querySelectorAll('.value-card')).toHaveLength(3);
      expect(root.querySelector('#vision-title')).not.toBeNull();
      expect(root.querySelector('#commitment-title')).not.toBeNull();
      expect(root.querySelector('mapit-ui-site-nav')).toBeNull();
      expect(root.querySelector('mapit-ui-site-footer')).not.toBeNull();
      language.setLanguage('en');
      fixture.detectChanges();
      expect(root.querySelector('#who-title')?.textContent).toContain('Who are we?');
      language.setLanguage('ja-JP');
      fixture.detectChanges();
      expect(root.querySelector('#values-title')?.textContent).toContain('私たちの価値観');
    } finally {
      language.setLanguage('es');
      fixture.destroy();
      TestBed.resetTestingModule();
    }
  });
});
