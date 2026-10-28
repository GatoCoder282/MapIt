import { publicMapFixture } from '../../../core/public-map.fixture';
import {
  findPublicSpace,
  PublicSpaceSummary,
  validPublicInterval,
} from '../../../core/public-space';
import { TestBed } from '@angular/core/testing';
import { publicMapLayout } from './public-map-layout';

describe('public map allowlist mapper', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('renders actual coordinates for an unnamed space, never a default capacity', () => {
    const fixture = TestBed.createComponent(PublicSpaceSummary);
    fixture.componentRef.setInput('space', findPublicSpace(publicMapFixture(), 'space-a'));
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Habitación sin nombre');
    expect(text).toContain('Planta baja');
    expect(text).toContain('x 120');
    expect(text).not.toContain('Capacidad informada');
    expect(text).not.toContain('space-a');
  });
  it('disambiguates repeated checkout labels using persisted positions', () => {
    const fixture = TestBed.createComponent(PublicSpaceSummary);
    const space = {
      id: 'a',
      name: 'Mesa del patio',
      label: 'Mesa del patio',
      floor: 'Planta baja',
      sector: 'Patio',
      x: 80,
      y: 40,
      capacity: 2,
    };
    fixture.componentRef.setInput('space', space);
    fixture.componentRef.setInput('peers', [space, { ...space, id: 'b', x: 180 }]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('x 80');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Capacidad informada: 2');
  });
  it('preserves sector-local geometry, canonical name, actual null capacity and safe availability', () => {
    const data = publicMapFixture();
    const sector = data.floors[0]!.sectors[0]!;
    Object.assign(sector.elements[0]!, {
      attributes: { secret: 'must not pass' },
      customer: 'private',
    });
    const layout = publicMapLayout(data.floors[0]!, sector);
    expect(layout.kind).toBe('sector');
    expect(layout.size).toEqual({ width: 1000, height: 600 });
    expect(layout.elements[0]).toEqual({
      id: 'space-a',
      type: 'ROOM',
      label: 'Habitación sin nombre',
      capacity: null,
      position: { x: 120, y: 60 },
      size: { width: 100, height: 80 },
      rotation: 15,
      state: 'AVAILABLE',
      availability: 'AVAILABLE',
      reservable: true,
      attributes: {},
    });
    expect(layout.elements[2]?.availability).toBe('RESERVED');
    expect(layout.elements[3]?.state).toBe('AVAILABLE');
  });
  it('resolves a descriptor by ID with real location, never a UUID label or invented capacity', () => {
    const descriptor = findPublicSpace(publicMapFixture(), 'space-a');
    expect(descriptor).toMatchObject({
      id: 'space-a',
      name: 'Habitación sin nombre',
      floor: 'Planta baja',
      sector: 'Salón',
      x: 120,
      y: 60,
      capacity: null,
    });
    expect(findPublicSpace(publicMapFixture(), 'unknown')).toBeNull();
  });
  it('marks repeated canonical names for positional disambiguation', () => {
    const data = publicMapFixture();
    data.floors[0]!.sectors[0]!.elements[1]!.name = 'Habitación sin nombre';
    expect(findPublicSpace(data, 'space-a')?.positionRequired).toBe(true);
  });
  it.each([
    ['2030-02-30', '19:00', '21:00'],
    ['2030-12-24', '', '21:00'],
    ['2030-12-24', '21:00', '19:00'],
  ])('rejects invalid interval %s %s %s', (date, start, end) => {
    expect(validPublicInterval(date, start, end)).toBe(false);
  });
});
