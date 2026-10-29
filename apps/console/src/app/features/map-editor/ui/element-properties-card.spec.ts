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
  const metadataError = signal<string | null>(null);
  const saveElementMetadata = vi.fn();
  const clearElementMetadata = vi.fn();
  beforeEach(async () => {
    canEditMetadata.set(true);
    selectedMetadata.set({ label: null, capacity: null });
    saveElementMetadata.mockReset();
    clearElementMetadata.mockReset();
    await TestBed.configureTestingModule({
      imports: [ElementPropertiesCardComponent],
      providers: [
        {
          provide: MapEditorStore,
          useValue: {
            canEditMetadata,
            selectedMetadata,
            saving,
            metadataError,
            selectedElementPosition: signal(null),
            saveElementMetadata,
            clearElementMetadata,
          },
        },
      ],
    }).compileComponents();
  });

  it('shows empty raw inputs instead of the derived display name, and saves or clears only on action', () => {
    const fixture = TestBed.createComponent(ElementPropertiesCardComponent);
    fixture.componentRef.setInput('element', element);
    fixture.detectChanges();
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
    root.querySelector<HTMLButtonElement>('[data-testid="element-metadata-save"]')!.click();
    expect(saveElementMetadata).toHaveBeenCalledWith('e1', 'Mesa terraza', '5');
    root.querySelector<HTMLButtonElement>('[data-testid="element-metadata-clear"]')!.click();
    expect(clearElementMetadata).toHaveBeenCalledWith('e1');
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
});
