import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ElementTemplate } from '@mapit/api-client';
import { MapEditorStore } from '../model/map-editor-store';
import { ElementLibraryComponent } from './element-library';

const template = (id: string, type: ElementTemplate['type'], name: string): ElementTemplate => ({
  id,
  type,
  name,
  createdAt: '2026-10-29T00:00:00Z',
  updatedAt: '2026-10-29T00:00:00Z',
});

describe('ElementLibraryComponent por vertical (HU-7.01/7.02 · MAP-247)', () => {
  const allowed = signal<readonly string[] | null>(['ROOM', 'DECOR']);

  beforeEach(async () => {
    allowed.set(['ROOM', 'DECOR']);
    await TestBed.configureTestingModule({
      imports: [ElementLibraryComponent],
      providers: [
        {
          provide: MapEditorStore,
          useValue: {
            templates: signal([
              template('t-room', 'ROOM', 'Suite doble'),
              template('t-table', 'TABLE', 'Mesa redonda 6 pax'),
            ]),
            templatesLoading: signal(false),
            isTypeAllowed: (type: string) => allowed()?.includes(type) ?? true,
            loadTemplates: vi.fn(),
            sectorSize: () => ({ width: 800, height: 600 }),
            createElementFromDrop: vi.fn(),
          },
        },
      ],
    }).compileComponents();
  });

  function cards(): string[] {
    const fixture = TestBed.createComponent(ElementLibraryComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    return [...host.querySelectorAll('.card-label')].map((el) => el.textContent?.trim() ?? '');
  }

  it('en un hotel solo ofrece habitaciones, decoración y sus plantillas', () => {
    const labels = cards();

    expect(labels).toContain('Suite doble');
    expect(labels).not.toContain('Mesa redonda 6 pax');
    expect(labels.length).toBe(3);
  });

  it('sin perfil cargado ofrece todo el catálogo base', () => {
    allowed.set(null);

    expect(cards()).toContain('Mesa redonda 6 pax');
  });
});
