import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAP_ENGINE } from '@mapit/map-engine';
import type { ElementTemplate, EstablishmentType } from '@mapit/api-client';
import { STRINGS } from '../../../core/strings';
import { EstablishmentContext } from '../../../core/establishment-context';
import { SpacesStore } from '../../../core/establishment-structure/spaces-store';
import { MapEditorStore } from '../model/map-editor-store';
import { ElementLibraryComponent } from './element-library';

describe('ElementLibraryComponent', () => {
  const createElementFromDrop = vi.fn();
  const createArrangement = vi.fn();
  const templates = signal<ElementTemplate[]>([]);
  const vertical = signal<EstablishmentType | null>('RESTAURANT');

  beforeEach(async () => {
    createElementFromDrop.mockReset();
    createArrangement.mockReset();
    templates.set([]);
    vertical.set('RESTAURANT');
    await TestBed.configureTestingModule({
      imports: [ElementLibraryComponent],
      providers: [
        {
          provide: MapEditorStore,
          useValue: {
            templates,
            templatesLoading: signal(false),
            loadTemplates: vi.fn(),
            canEdit: signal(true),
            busy: signal(false),
            sectorSize: signal({ width: 600, height: 400 }),
            sectorId: signal('sector-1'),
            createElementFromDrop,
            createArrangement,
          },
        },
        {
          provide: SpacesStore,
          useValue: { establishmentType: vertical, loadEstablishmentType: vi.fn() },
        },
        { provide: EstablishmentContext, useValue: { active: signal({ id: 'venue' }) } },
        { provide: MAP_ENGINE, useValue: { furniturePreview: vi.fn(() => null) } },
      ],
    }).compileComponents();
  });

  function render() {
    const fixture = TestBed.createComponent(ElementLibraryComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('dialog')).toBeNull();
    return { fixture, root };
  }

  it('selects a model before inserting its configured metadata and appearance', () => {
    const { fixture, root } = render();
    expect(root.querySelectorAll('.category-button')).toHaveLength(4);
    const square = root.querySelector<HTMLButtonElement>(
      '[data-testid="library-card-model:TABLE:square"]',
    )!;
    square.click();
    fixture.detectChanges();
    expect(createElementFromDrop).not.toHaveBeenCalled();
    const name = root.querySelector<HTMLInputElement>('input[type=text]')!;
    name.value = 'Mesa ventana';
    name.dispatchEvent(new Event('input'));
    const capacity = root.querySelector<HTMLInputElement>('input[type=number]')!;
    capacity.value = '6';
    capacity.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('[data-testid=library-insert]')!.click();
    expect(createElementFromDrop).toHaveBeenCalledWith(
      'base:TABLE',
      250,
      150,
      expect.objectContaining({
        label: 'Mesa ventana',
        capacity: 6,
        size: { width: 100, height: 100 },
      }),
    );
    expect(createElementFromDrop.mock.calls[0]?.[3]).toMatchObject({
      finish: { variant: 'square' },
    });
    expect(root.querySelector('[data-testid=library-insert]')).not.toBeNull();
  });

  it('drags a configured model and centers it at the canvas drop point', () => {
    const { fixture, root } = render();
    root.querySelector<HTMLButtonElement>('[data-testid="library-card-model:TABLE:oval"]')!.click();
    fixture.detectChanges();
    const name = root.querySelector<HTMLInputElement>('input[type=text]')!;
    name.value = 'Mesa arrastrada';
    name.dispatchEvent(new Event('input'));
    const capacity = root.querySelector<HTMLInputElement>('input[type=number]')!;
    capacity.value = '8';
    capacity.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const setData = vi.fn();
    const event = new Event('dragstart', { cancelable: true });
    const dataTransfer = { setData, effectAllowed: '' };
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    const card = root.querySelector<HTMLButtonElement>(
      '[data-testid="library-card-model:TABLE:oval"]',
    )!;
    expect(card.draggable).toBe(true);
    card.dispatchEvent(event);
    expect(setData).toHaveBeenCalledWith('text/plain', 'catalog:model:TABLE:oval');
    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(createElementFromDrop).not.toHaveBeenCalled();
    fixture.componentInstance.dropModel('catalog:model:TABLE:oval', 300, 200);
    expect(createElementFromDrop).toHaveBeenCalledWith(
      'base:TABLE',
      220,
      150,
      expect.objectContaining({ label: 'Mesa arrastrada', capacity: 8 }),
    );
    expect(createElementFromDrop.mock.calls[0]?.[3]).toMatchObject({ finish: { variant: 'oval' } });
    fixture.componentInstance.dropModel('catalog:model:TABLE:oval', 100, 100);
    expect(createElementFromDrop).toHaveBeenCalledTimes(1);
  });

  it('cancels a drag without creating an element and rejects unrelated drop keys', () => {
    const { fixture, root } = render();
    fixture.componentInstance.dropModel('catalog:base:TABLE', 200, 200);
    expect(createElementFromDrop).not.toHaveBeenCalled();
    const event = new Event('dragstart', { cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: { setData: vi.fn(), effectAllowed: '' },
    });
    const card = root.querySelector<HTMLButtonElement>('[data-testid="library-card-base:TABLE"]')!;
    card.dispatchEvent(event);
    card.dispatchEvent(new Event('dragend'));
    fixture.componentInstance.dropModel('catalog:base:TABLE', 200, 200);
    expect(createElementFromDrop).not.toHaveBeenCalled();
  });

  it('only exposes rooms and decoration in hotels', () => {
    vertical.set('HOTEL');
    const { root } = render();
    expect(root.querySelectorAll('.category-button')).toHaveLength(6);
    expect(root.querySelector('[data-testid="library-card-model:room-single"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="library-card-base:TABLE"]')).toBeNull();
    expect(root.querySelector('[data-testid="library-card-base:SEAT"]')).toBeNull();
  });

  it('centers a composed auditorium and rejects arrangements larger than the sector', () => {
    vertical.set('EVENT_HALL');
    const { fixture, root } = render();
    const category = Array.from(root.querySelectorAll<HTMLButtonElement>('.category-button')).find(
      (button) => button.textContent?.includes('Butacas'),
    )!;
    category.click();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('[data-testid="library-card-model:auditorium"]')!.click();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('[data-testid=library-insert]')!.click();
    expect(createArrangement).toHaveBeenCalledWith(
      'SEAT',
      202,
      128,
      3,
      4,
      12,
      expect.objectContaining({ size: { width: 40, height: 40 } }),
    );
    expect(createArrangement.mock.calls[0]?.[6]).toMatchObject({ finish: { variant: 'chair' } });
    const rows = root.querySelector<HTMLInputElement>('.arrangement-fields input')!;
    rows.value = '10';
    rows.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(root.querySelector<HTMLButtonElement>('[data-testid=library-insert]')!.disabled).toBe(
      true,
    );
    expect(root.querySelector('[role=alert]')).not.toBeNull();
  });

  it('blocks invalid capacities without inserting', () => {
    const { fixture, root } = render();
    const capacity = root.querySelector<HTMLInputElement>('input[type=number]')!;
    capacity.value = '0';
    capacity.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(root.querySelector<HTMLButtonElement>('[data-testid=library-insert]')!.disabled).toBe(
      true,
    );
    expect(createElementFromDrop).not.toHaveBeenCalled();
  });

  it('searches saved templates within the supported vertical', () => {
    templates.set(
      Array.from({ length: 6 }, (_, index) => ({
        id: String(index),
        name: `Barra exterior ${index}`,
        type: 'BAR',
        createdAt: '',
        updatedAt: '',
      })),
    );
    const { fixture, root } = render();
    const search = root.querySelector<HTMLInputElement>('input[type=search]')!;
    search.value = 'exterior 4';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="library-card-base:TABLE"]')).toBeNull();
    expect(root.querySelector('[data-testid="library-card-tpl:4"]')).not.toBeNull();
    expect(root.textContent).toContain(STRINGS.spaces.editor.library.insert);
  });
});
