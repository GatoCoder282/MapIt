import { TestBed } from '@angular/core/testing';
import type { RealtimeConnectionState } from '@mapit/realtime';
import { beforeEach, describe, expect, it } from 'vitest';

import { OccupancyPanel } from './occupancy-panel';
import { STRINGS } from '../../../../core/strings';

const COUNTS = {
  AVAILABLE: 12,
  OCCUPIED: 5,
  RESERVED: 3,
  CLEANING: 2,
  OUT_OF_SERVICE: 1,
} as const;

describe('OccupancyPanel (panel de ocupación en vivo)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [OccupancyPanel] });
  });

  it('dibuja las cinco filas siempre, con 0 cuando un estado no tiene elementos', () => {
    const fixture = TestBed.createComponent(OccupancyPanel);
    fixture.componentRef.setInput('counts', { ...COUNTS, CLEANING: 0 });
    fixture.componentRef.setInput('total', 21);
    fixture.detectChanges();

    const cells = (fixture.nativeElement as HTMLElement).querySelectorAll('.state-cell');
    expect(cells.length).toBe(5);

    const labels = [...cells].map((cell) => cell.querySelector('.state-label')?.textContent);
    expect(labels).toEqual([
      STRINGS.adminDashboardHome.occupancyStates.AVAILABLE,
      STRINGS.adminDashboardHome.occupancyStates.OCCUPIED,
      STRINGS.adminDashboardHome.occupancyStates.RESERVED,
      STRINGS.adminDashboardHome.occupancyStates.CLEANING,
      STRINGS.adminDashboardHome.occupancyStates.OUT_OF_SERVICE,
    ]);

    const counts = [...cells].map((cell) => cell.querySelector('.state-count')?.textContent);
    expect(counts).toEqual(['12', '5', '3', '0', '1']);
  });

  it('con el registro vacío las cinco filas salen con 0 (no desaparecen)', () => {
    const fixture = TestBed.createComponent(OccupancyPanel);
    fixture.componentRef.setInput('counts', {});
    fixture.componentRef.setInput('total', 3);
    fixture.detectChanges();

    const cells = (fixture.nativeElement as HTMLElement).querySelectorAll('.state-cell');
    expect(cells.length).toBe(5);
    expect(
      [...cells].every((cell) => cell.querySelector('.state-count')?.textContent === '0'),
    ).toBe(true);
  });

  it('cada fila lleva el color del mapa (los cinco tokens de estado)', () => {
    const fixture = TestBed.createComponent(OccupancyPanel);
    fixture.componentRef.setInput('counts', COUNTS);
    fixture.componentRef.setInput('total', 23);
    fixture.detectChanges();

    const dots = (fixture.nativeElement as HTMLElement).querySelectorAll('.state-dot');
    const states = [...dots].map((dot) => dot.getAttribute('data-state'));
    expect(states).toEqual(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'OUT_OF_SERVICE']);
  });

  it('sin elementos muestra el estado vacío, no un 0 %', () => {
    const fixture = TestBed.createComponent(OccupancyPanel);
    fixture.componentRef.setInput('total', 0);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(STRINGS.adminDashboardHome.occupancyEmpty);
    expect(compiled.querySelector('.state-cell')).toBeNull();
  });

  it('si el resumen falla, el panel muestra el error y reintenta sin tumbar nada', () => {
    const fixture = TestBed.createComponent(OccupancyPanel);
    fixture.componentRef.setInput('failed', true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[role="alert"]')).not.toBeNull();
    expect(compiled.textContent).toContain(STRINGS.adminDashboardHome.occupancyError);

    let emitted = 0;
    fixture.componentInstance.retry.subscribe(() => emitted++);
    const button = compiled.querySelector('button') as HTMLButtonElement;
    button.click();

    expect(emitted).toBe(1);
  });

  it('el indicador de conexión dice la verdad: "En vivo" solo con el socket conectado', () => {
    const casos: readonly [RealtimeConnectionState, string][] = [
      ['connected', STRINGS.adminDashboardHome.occupancyLive],
      ['connecting', STRINGS.adminDashboardHome.occupancyConnecting],
      ['disconnected', STRINGS.adminDashboardHome.occupancyDisconnected],
      ['error', STRINGS.adminDashboardHome.occupancyConnectionError],
      ['disabled', STRINGS.adminDashboardHome.occupancySnapshot],
      ['idle', STRINGS.adminDashboardHome.occupancySnapshot],
    ];

    for (const [estado, etiqueta] of casos) {
      const fixture = TestBed.createComponent(OccupancyPanel);
      fixture.componentRef.setInput('connection', estado);
      fixture.componentRef.setInput('total', 23);
      fixture.detectChanges();

      const chip = (fixture.nativeElement as HTMLElement).querySelector('.live-chip');
      expect(chip?.textContent).toContain(etiqueta);
      if (estado !== 'connected') {
        expect(chip?.textContent).not.toContain(STRINGS.adminDashboardHome.occupancyLive);
      }
    }
  });

  it('sin directo, el panel explica que lo que se ve es una instantánea', () => {
    const fixture = TestBed.createComponent(OccupancyPanel);
    fixture.componentRef.setInput('connection', 'disabled');
    fixture.componentRef.setInput('total', 23);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(STRINGS.adminDashboardHome.occupancyDisabledNote);
  });

  it('los contadores no son una región viva: solo la conexión se anuncia', () => {
    const fixture = TestBed.createComponent(OccupancyPanel);
    fixture.componentRef.setInput('counts', COUNTS);
    fixture.componentRef.setInput('total', 23);
    fixture.componentRef.setInput('connection', 'connected');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    // El chip es la única región viva (role="status" = polite).
    expect(compiled.querySelector('.live-chip')?.getAttribute('role')).toBe('status');
    // Ningún contador vive dentro de una región viva: cambian en cada cambio
    // de estado y no deben anunciar nada.
    const contador = compiled.querySelector('.state-count');
    expect(contador?.closest('[aria-live], [role="status"]')).toBeNull();
  });

  it('el esqueleto de carga se anuncia y no pinta cifras', () => {
    const fixture = TestBed.createComponent(OccupancyPanel);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const skeleton = compiled.querySelector('[role="status"][aria-busy="true"]');
    expect(skeleton).not.toBeNull();
    expect(skeleton?.getAttribute('aria-label')).toBe(STRINGS.adminDashboardHome.loading);
    expect(compiled.querySelector('.state-cell')).toBeNull();
  });

  it('el panel no inventa datos: sin total no enseña el total', () => {
    const fixture = TestBed.createComponent(OccupancyPanel);
    fixture.componentRef.setInput('counts', COUNTS);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.panel-total')).toBeNull();
  });
});
