import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SpaceElement } from '@mapit/map-engine';
import { MapEditorStore } from '../model/map-editor-store';
import { ElementPropertiesCardComponent } from './element-properties-card';

const element: SpaceElement = {
  id: 'e1',
  type: 'TABLE',
  label: 'Mesa sin nombre',
  capacity: null,
  position: { x: 1, y: 2 },
  size: { width: 80, height: 80 },
  rotation: 0,
  state: 'AVAILABLE',
  reservable: true,
  attributes: {},
};

describe('ElementPropertiesCardComponent metadata', () => {
  const canEditMetadata = signal(true);
  const selectedMetadata = signal<{ label: string | null; capacity: number | null } | null>({
    label: null,
    capacity: null,
  });
  const saving = signal(false);
  const busy = signal(false);
  const loading = signal(false);
  const metadataError = signal<string | null>(null);
  const saveElementMetadata = vi.fn();
  const clearElementMetadata = vi.fn();
  const resizeElement = vi.fn();
  beforeEach(async () => {
    canEditMetadata.set(true);
    selectedMetadata.set({ label: null, capacity: null });
    metadataError.set(null);
    saveElementMetadata.mockReset();
    clearElementMetadata.mockReset();
    resizeElement.mockReset();
    await TestBed.configureTestingModule({
      imports: [ElementPropertiesCardComponent],
      providers: [
        {
          provide: MapEditorStore,
          useValue: {
            canEditMetadata,
            selectedMetadata,
            saving,
            busy,
            dirty: signal(false),
            loading,
            metadataError,
            selectedElementPosition: signal(null),
            saveElementMetadata,
            clearElementMetadata,
            resizeElement,
          },
        },
      ],
    }).compileComponents();
  });

  it('shows empty raw inputs instead of the derived display name, and saves or clears only on action', () => {
    const fixture = TestBed.createComponent(ElementPropertiesCardComponent);
    fixture.componentRef.setInput('element', element);
    fixture.detectChanges();
    expect(fixture.componentInstance.dirty()).toBe(false);
    const root = fixture.nativeElement as HTMLElement;
    const label = root.querySelector<HTMLInputElement>('[data-testid="element-metadata-label"]')!;
    const capacity = root.querySelector<HTMLInputElement>(
      '[data-testid="element-metadata-capacity"]',
    )!;
    expect(label.value).toBe('');
    expect(capacity.value).toBe('');
    expect(saveElementMetadata).not.toHaveBeenCalled();
    label.value = 'Mesa terraza';
    label.dispatchEvent(new Event('input'));
    capacity.value = '5';
    capacity.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.dirty()).toBe(true);
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('[data-testid="element-metadata-save"]')!.click();
    expect(saveElementMetadata).toHaveBeenCalledWith('e1', 'Mesa terraza', '5');
    root.querySelector<HTMLButtonElement>('[data-testid="element-metadata-clear"]')!.click();
    expect(clearElementMetadata).toHaveBeenCalledWith('e1');
    selectedMetadata.set({ label: 'Mesa terraza', capacity: 5 });
    TestBed.tick();
    expect(fixture.componentInstance.dirty()).toBe(false);
  });

  it('preserves an unfinished name when the layout response updates geometry', () => {
    const fixture = TestBed.createComponent(ElementPropertiesCardComponent);
    fixture.componentRef.setInput('element', element);
    fixture.detectChanges();
    const label = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '[data-testid="element-metadata-label"]',
    )!;
    label.value = 'Borrador';
    label.dispatchEvent(new Event('input'));
    selectedMetadata.set({ label: null, capacity: null });
    fixture.componentRef.setInput('element', { ...element, position: { x: 20, y: 24 } });
    fixture.detectChanges();
    expect(label.value).toBe('Borrador');
    expect(fixture.componentInstance.dirty()).toBe(true);
    fixture.componentInstance.discardDraft();
    fixture.detectChanges();
    expect(label.value).toBe('');
    expect(fixture.componentInstance.dirty()).toBe(false);
  });

  it('hides editing controls from other roles', () => {
    canEditMetadata.set(false);
    const fixture = TestBed.createComponent(ElementPropertiesCardComponent);
    fixture.componentRef.setInput('element', element);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="element-metadata"]'),
    ).toBeNull();
  });

  it('disables element mutations while a write is pending', () => {
    const fixture = TestBed.createComponent(ElementPropertiesCardComponent);
    fixture.componentRef.setInput('element', element);
    busy.set(true);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(
      root.querySelector<HTMLInputElement>('[data-testid="element-metadata-label"]')?.disabled,
    ).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('.btn-delete')?.disabled).toBe(true);
    fixture.destroy();
    busy.set(false);
  });

  it('shows decoration geometry and name without table capacity or operational status', () => {
    const fixture = TestBed.createComponent(ElementPropertiesCardComponent);
    fixture.componentRef.setInput('element', {
      ...element,
      type: 'DECOR',
      reservable: false,
      state: 'CLEANING',
    });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="element-metadata-label"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="element-metadata-capacity"]')).toBeNull();
    expect(root.querySelector('.state-badge')).toBeNull();
    const label = root.querySelector<HTMLInputElement>('[data-testid="element-metadata-label"]')!;
    label.value = 'Planta';
    label.dispatchEvent(new Event('input'));
    label.dispatchEvent(new Event('blur'));
    expect(saveElementMetadata).toHaveBeenCalledWith('e1', 'Planta', '');
  });

  it('keeps a focused geometry edit in the draft before a change or blur event', () => {
    const fixture = TestBed.createComponent(ElementPropertiesCardComponent);
    fixture.componentRef.setInput('element', element);
    fixture.detectChanges();
    const x = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '[data-testid="map-element-x"]',
    )!;
    x.value = '';
    x.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.dirty()).toBe(true);
    expect(fixture.componentInstance.applyGeometryDraft()).toBe(false);
    expect(resizeElement).not.toHaveBeenCalled();
    x.value = '155';
    x.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.applyGeometryDraft()).toBe(true);
    expect(resizeElement).toHaveBeenCalledWith('e1', 155, 2, 80, 80, 0);
  });
});
