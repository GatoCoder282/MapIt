import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Tenant } from '@mapit/api-client';
import { beforeEach, describe, expect, it } from 'vitest';

import { PlatformTenantsTable } from './tenants-table';
import { STRINGS } from '../../../../../core/strings';

/** Un tenant de laboratorio; los sobreescritos son los que cada test cambia. */
function tenant(over: Partial<Tenant> = {}): Tenant {
  return {
    id: 'id-1',
    name: 'Restaurante Central',
    slug: 'restaurante-central',
    vertical: 'RESTAURANT',
    status: 'ACTIVE',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

/** Hace "hace N días" una fecha ISO: el badge "Sin cambios" mira los 30 días. */
function haceDias(dias: number): string {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
}

describe('PlatformTenantsTable (panel de tenants)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PlatformTenantsTable],
      providers: [provideRouter([])],
    });
  });

  function render(
    entradas: Partial<{
      tenants: readonly Tenant[];
      pagina: number;
      totalPaginas: number;
      totalElementos: number;
      busqueda: string;
      hayFiltros: boolean;
      loading: boolean;
      failed: boolean;
    }> = {},
  ) {
    const fixture = TestBed.createComponent(PlatformTenantsTable);
    for (const [clave, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(clave, valor);
    }
    fixture.detectChanges();
    return fixture;
  }

  /* ── Los cinco estados de una fila ───────────────────────── */

  it('fila activa: chip claro, sin badge de "sin cambios"', () => {
    const fixture = render({ tenants: [tenant({ updatedAt: haceDias(2) })] });
    const compiled = fixture.nativeElement as HTMLElement;

    const chip = compiled.querySelector('.chip');
    expect(chip?.textContent).toContain(STRINGS.platformPanel.statusActive);
    expect(chip?.classList.contains('suspended')).toBe(false);
    expect(compiled.querySelector('.badge')).toBeNull();
  });

  it('fila suspendida: chip de error con su color', () => {
    const fixture = render({ tenants: [tenant({ status: 'SUSPENDED' })] });
    const compiled = fixture.nativeElement as HTMLElement;

    const chip = compiled.querySelector('.chip');
    expect(chip?.textContent).toContain(STRINGS.platformPanel.statusSuspended);
    expect(chip?.classList.contains('suspended')).toBe(true);
  });

  it('fila activa con 30+ días sin modificarse: badge "Sin cambios"', () => {
    const fixture = render({ tenants: [tenant({ updatedAt: haceDias(45) })] });
    const compiled = fixture.nativeElement as HTMLElement;

    const badge = compiled.querySelector('.badge');
    expect(badge?.textContent).toContain(STRINGS.platformPanel.badgeNoChanges);
    expect(badge?.querySelector('.badge-dot')).not.toBeNull();
  });

  it('fila sin fecha de cambio: "Sin datos" (nunca un 0 inventado)', () => {
    const fixture = render({ tenants: [tenant({ updatedAt: '' })] });
    const compiled = fixture.nativeElement as HTMLElement;

    const celdas = compiled.querySelectorAll('tbody td');
    expect(celdas[3]?.textContent?.trim()).toBe(STRINGS.platformPanel.noData);
  });

  it('fila sin fecha de alta: "Sin datos" en la columna de alta', () => {
    const fixture = render({ tenants: [tenant({ createdAt: '' })] });
    const compiled = fixture.nativeElement as HTMLElement;

    const celdas = compiled.querySelectorAll('tbody td');
    expect(celdas[2]?.textContent?.trim()).toBe(STRINGS.platformPanel.noData);
  });

  it('la acción de la fila nombra al tenant y lleva a su detalle', () => {
    const fixture = render({ tenants: [tenant({ name: 'Hotel Central' })] });
    const compiled = fixture.nativeElement as HTMLElement;

    const accion = compiled.querySelector<HTMLAnchorElement>('.row-action');
    expect(accion?.getAttribute('aria-label')).toBe(
      STRINGS.platformPanel.detailFor.replace('{name}', 'Hotel Central'),
    );
    expect(accion?.getAttribute('href')).toContain('/admin/tenants/');
  });

  /* ── Estados de la tabla ──────────────────────────────────── */

  it('estado vacío: el mensaje y la acción de limpiar filtros', () => {
    const fixture = render({ tenants: [], hayFiltros: true });
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain(STRINGS.platformPanel.emptyTitle);
    expect(compiled.textContent).toContain(STRINGS.platformPanel.empty);

    const boton = compiled.querySelector<HTMLButtonElement>('.empty-cell button');
    expect(boton?.textContent).toContain(STRINGS.platformPanel.clearFilters);
  });

  it('estado vacío sin filtros: no ofrece limpiar nada', () => {
    const fixture = render({ tenants: [], hayFiltros: false });
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain(STRINGS.platformPanel.emptyTitle);
    expect(compiled.querySelector('.empty-cell button')).toBeNull();
  });

  it('estado de error: mensaje con role="alert" y botón de reintento', () => {
    const fixture = render({ failed: true });
    const compiled = fixture.nativeElement as HTMLElement;

    const alerta = compiled.querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain(STRINGS.platformPanel.tableError);

    let reintentos = 0;
    fixture.componentInstance.reintentar.subscribe(() => reintentos++);
    const boton = compiled.querySelector<HTMLButtonElement>('.state.error button');
    boton?.click();

    expect(reintentos).toBe(1);
  });

  it('el error aísla su bloque: la tabla no se dibuja debajo', () => {
    const fixture = render({ failed: true, tenants: [tenant()] });
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('table')).toBeNull();
  });

  it('carga: el esqueleto se anuncia y no pinta filas', () => {
    const fixture = render({ loading: true });
    const compiled = fixture.nativeElement as HTMLElement;

    const esqueleto = compiled.querySelector('[role="status"][aria-busy="true"]');
    expect(esqueleto).not.toBeNull();
    expect(esqueleto?.getAttribute('aria-label')).toBe(STRINGS.platformPanel.loading);
    expect(compiled.querySelector('tbody tr')).toBeNull();
  });

  /* ── Paginación ───────────────────────────────────────────── */

  it('el pie dice qué filas se ven y cuántas hay en total', () => {
    const fixture = render({
      tenants: [tenant({ id: 'a' }), tenant({ id: 'b' })],
      pagina: 0,
      totalPaginas: 7,
      totalElementos: 35,
    });
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.count')?.textContent).toContain('1');
    expect(compiled.querySelector('.count')?.textContent).toContain('2');
    expect(compiled.querySelector('.count')?.textContent).toContain('35');
  });

  it('la paginación marca la página actual y navega', () => {
    const fixture = render({
      tenants: [tenant()],
      pagina: 1,
      totalPaginas: 5,
      totalElementos: 35,
    });
    const compiled = fixture.nativeElement as HTMLElement;

    const actual = compiled.querySelector('.page-btn.current');
    expect(actual?.textContent?.trim()).toBe('2');
    expect(actual?.getAttribute('aria-current')).toBe('page');

    let destino = -1;
    fixture.componentInstance.cambioPagina.subscribe((pagina) => (destino = pagina));
    const flecha = compiled.querySelectorAll<HTMLButtonElement>('.page-btn.arrow')[1];
    flecha?.click();

    expect(destino).toBe(2);
  });

  /* ── Datos honestos ───────────────────────────────────────── */

  it('la tabla es semántica: caption y cabeceras con scope', () => {
    const fixture = render({ tenants: [tenant()] });
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('caption')?.textContent).toContain(
      STRINGS.platformPanel.tableCaption,
    );
    expect(compiled.querySelectorAll('thead th[scope="col"]').length).toBe(6);
    expect(compiled.querySelector('tbody th[scope="row"]')).not.toBeNull();
  });

  it('la vertical se nombra con texto y se marca con su punto', () => {
    const fixture = render({ tenants: [tenant({ vertical: 'NIGHTCLUB' })] });
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain(STRINGS.verticals.NIGHTCLUB);
    expect(compiled.querySelector('.vertical-cell .dot')).not.toBeNull();
  });

  it('los contadores no viven en una región viva', () => {
    const fixture = render({ tenants: [tenant()] });
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[aria-live]')).toBeNull();
    expect(compiled.querySelector('.chip')?.closest('[role="status"]')).toBeNull();
  });
});
