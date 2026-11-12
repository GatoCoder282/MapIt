import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { I18nService, provideI18n } from '@mapit/i18n';
import { PublicRuntimeConfig } from '../../core/runtime-config';
import { Negocios } from './negocios';

describe('Negocios', () => {
  it('renders the compact business showcase while preserving access and navigation', () => {
    TestBed.configureTestingModule({
      imports: [Negocios],
      providers: [
        provideRouter([]),
        {
          provide: PublicRuntimeConfig,
          useValue: { config: () => ({ consoleBaseUrl: '/console' }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(Negocios);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('mapit-ui-site-nav')).toBeNull();
    expect(root.querySelectorAll('.tool-card')).toHaveLength(3);
    expect(root.querySelector('.map-result figcaption')?.textContent).toContain('Una sola vista');
    expect(root.querySelector('#coordinacion')).not.toBeNull();
    expect(root.querySelectorAll('.comparison-legend li')).toHaveLength(4);
    expect(root.querySelector('.reservation-preview')?.textContent).toContain('María Gómez');
    expect(root.querySelectorAll('h1')).toHaveLength(1);
    expect(root.querySelectorAll('mp-business-comparison')).toHaveLength(1);
    expect(root.querySelector('main')?.firstElementChild?.tagName).toBe('MP-BUSINESS-COMPARISON');
    expect(root.querySelector('.hero')).toBeNull();
    expect(root.querySelectorAll('.intro-features li')).toHaveLength(5);
    expect(root.querySelector('.booking-phone')).not.toBeNull();
    expect(root.querySelector('#business-editor-title')?.textContent).toContain(
      'Diseñá el espacio como',
    );
    expect(root.querySelectorAll('.editor-benefits li')).toHaveLength(3);
    expect(root.querySelector('.editor-ready')?.textContent).toContain('Plano listo');
    expect(root.querySelectorAll('.editor-callouts li')).toHaveLength(3);
    expect(root.querySelectorAll('.gallery li')).toHaveLength(4);
    expect(root.querySelectorAll('.industry-caption svg')).toHaveLength(4);
    expect(root.querySelector('.industries .section-heading p')?.textContent).toContain(
      'Un motor flexible',
    );
    expect(root.querySelectorAll('.industry-caption span')).toHaveLength(0);
    expect(root.querySelectorAll('.occupancy-statuses > div')).toHaveLength(5);
    const mapStates = root.querySelectorAll('.table-state');
    expect(mapStates).toHaveLength(9);
    const displayedCounts = [...root.querySelectorAll('.occupancy-statuses dd')].map((node) =>
      Number(node.textContent),
    );
    expect(displayedCounts).toEqual([5, 1, 1, 1, 1]);
    expect(displayedCounts.reduce((total, count) => total + count, 0)).toBe(mapStates.length);
    expect(root.querySelectorAll('.operation-benefits li')).toHaveLength(3);
    expect(root.querySelectorAll('.status-legend li')).toHaveLength(5);
    expect(root.querySelector('.operation-actions a[href="/console/home"]')).not.toBeNull();
    expect(root.querySelector('.operation-actions a[href="/console/spaces/setup"]')).not.toBeNull();
    expect(root.querySelector('.example-note')?.textContent).toContain('datos de ejemplo');
    expect(root.querySelectorAll('.venues-benefits li')).toHaveLength(3);
    expect(root.querySelector('.venues-visual img')).not.toBeNull();
    expect(root.querySelector('#como-funciona')).not.toBeNull();
    expect(root.querySelector('.hero-actions a[href="/console/spaces/setup"]')).not.toBeNull();
    expect(root.querySelector('a[href="#como-funciona"]')).toBeNull();
    expect(root.querySelector('dialog')).not.toBeNull();
    expect(root.querySelector('mapit-ui-site-footer')).not.toBeNull();

    fixture.destroy();
    TestBed.resetTestingModule();
  });
  it('traduce la sección de presentación y los horarios al cambiar el idioma', () => {
    TestBed.configureTestingModule({
      imports: [Negocios],
      providers: [
        provideRouter([]),
        provideI18n(),
        {
          provide: PublicRuntimeConfig,
          useValue: { config: () => ({ consoleBaseUrl: '/console' }) },
        },
      ],
    });
    const language = TestBed.inject(I18nService);
    language.initialize();
    language.setLanguage('es');
    const fixture = TestBed.createComponent(Negocios);
    try {
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      const section = root.querySelector('.business-intro')!;
      expect(section.querySelectorAll('.intro-features li')).toHaveLength(5);
      expect(section.textContent).toContain('Tu negocio en');
      expect(section.textContent).not.toMatch(
        /restaurante de ejemplo|vista ilustrativa|datos de ejemplo|24 confirmadas|ejemplo de actualización/i,
      );
      expect(section.querySelector('.phone-venue-card')).not.toBeNull();
      expect(section.querySelector('.intro-occupancy')?.textContent).toContain('78%');
      expect(section.querySelector('.phone-time-selected')?.textContent).toContain('p. m.');

      language.setLanguage('en');
      fixture.detectChanges();
      expect(section.textContent).toContain('Your business,');
      expect(root.querySelector('.example-note')?.textContent).toContain('sample data');
      expect(section.textContent).toContain('Table 8 occupied');
      expect(section.querySelector('.phone-time-selected')?.textContent).toContain('PM');
      expect(section.querySelector('img')?.alt).toContain('Restaurant manager');

      language.setLanguage('ja-JP');
      fixture.detectChanges();
      expect(section.textContent).toContain('ビジネスを');
      expect(root.querySelector('.example-note')?.textContent).toContain('サンプルデータ');
      expect(section.textContent).toContain('テーブル8は利用中');
      expect(section.querySelector('.phone-time-selected')?.textContent).toContain('20:00');
    } finally {
      language.setLanguage('es');
      fixture.destroy();
      TestBed.resetTestingModule();
    }
  });
});
