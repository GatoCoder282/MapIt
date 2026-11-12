import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';

import { FeatureFlagService } from '@mapit/feature-flags';
import { STRINGS } from '../../../core/strings';
import { SpacesStore } from '../model/spaces-store';
import { SectorPageComponent } from './sector-page';

describe('SectorPageComponent: borrador anidado', () => {
  it('la guarda consulta el formulario real dentro de SectorList y solo pregunta con cambios', async () => {
    const sectorDraft = signal({ name: '' });
    const editing = signal(false);
    const store = {
      strings_: STRINGS.spaces,
      busy: signal(false),
      saving: signal(false),
      error: signal(null),
      floors: signal([]),
      sectorDraft: sectorDraft.asReadonly(),
      isEditingSector: computed(() => editing()),
      sectorsByFloorId: () => [],
      sectorsLoading: () => false,
      loadSectorsByFloor: vi.fn(),
      startNewSector: () => {
        editing.set(false);
        sectorDraft.set({ name: '' });
      },
      setSectorName: (name: string) => sectorDraft.set({ name }),
      saveSector: () => of(null),
    };

    await TestBed.configureTestingModule({
      imports: [SectorPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ floorId: 'floor-a' })) },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: SpacesStore, useValue: store },
        { provide: FeatureFlagService, useValue: { isEnabled: () => signal(true) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SectorPageComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.canDeactivate()).toBe(true);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.add-sector-btn')!
      .click();
    fixture.detectChanges();
    expect(fixture.componentInstance.canDeactivate()).toBe(true);

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input[type="text"]',
    )!;
    input.value = 'Terraza';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(fixture.componentInstance.canDeactivate()).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    confirm.mockReturnValue(true);
    expect(fixture.componentInstance.canDeactivate()).toBe(true);
    fixture.destroy();
  });
});
