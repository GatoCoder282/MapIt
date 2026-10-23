import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { PlatformKpiCard } from './kpi-card';
import { STRINGS } from '../../../../../core/strings';

describe('PlatformKpiCard (tarjeta de KPI del panel)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PlatformKpiCard],
      providers: [provideRouter([])],
    });
  });

  function render(loading = false) {
    const fixture = TestBed.createComponent(PlatformKpiCard);
    fixture.componentRef.setInput('label', STRINGS.platformPanel.kpiTotalTitle);
    fixture.componentRef.setInput('value', '35');
    fixture.componentRef.setInput('icon', 'tenants');
    fixture.componentRef.setInput('link', '/admin/tenants');
    fixture.componentRef.setInput('linkAria', STRINGS.platformPanel.kpiTotalLink);
    fixture.componentRef.setInput('loading', loading);
    fixture.detectChanges();
    return fixture;
  }

  it('dibuja el título y la cifra', () => {
    const fixture = render();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain(STRINGS.platformPanel.kpiTotalTitle);
    expect(compiled.querySelector('.kpi-value')?.textContent?.trim()).toBe('35');
  });

  it('el chevron es un enlace real con nombre accesible', () => {
    const fixture = render();
    const compiled = fixture.nativeElement as HTMLElement;

    const chevron = compiled.querySelector<HTMLAnchorElement>('.kpi-chevron');
    expect(chevron?.getAttribute('href')).toBe('/admin/tenants');
    expect(chevron?.getAttribute('aria-label')).toBe(STRINGS.platformPanel.kpiTotalLink);
  });

  it('el pie proyectado se dibuja dentro de la tarjeta', () => {
    const fixture = render();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.kpi-foot')).not.toBeNull();
  });

  it('la carga dibuja el esqueleto y anuncia el estado, sin cifras', () => {
    const fixture = render(true);
    const compiled = fixture.nativeElement as HTMLElement;

    const esqueleto = compiled.querySelector('[role="status"][aria-busy="true"]');
    expect(esqueleto).not.toBeNull();
    expect(esqueleto?.getAttribute('aria-label')).toBe(STRINGS.platformPanel.loading);
    expect(compiled.querySelector('.kpi-value')).toBeNull();
  });
});
