import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AccessibleEstablishment } from '@mapit/api-client';
import { ActivatedRoute, convertToParamMap, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { EstablishmentContext } from '../../../core/establishment-context';
import { STRINGS } from '../../../core/strings';
import { SpacesApiService } from '../data/spaces-api';
import { SpacesStore } from '../model/spaces-store';
import { WizardEstablishmentComponent } from './wizard-establishment';

const ACTIVE: AccessibleEstablishment = {
  id: '92000000-0000-0000-0000-000000000001',
  name: 'Centro',
  slug: 'centro',
  address: null,
  timezone: 'America/La_Paz',
  canManagePayments: false,
  canCheckIn: true,
};
const OTHER = {
  ...ACTIVE,
  id: '92000000-0000-0000-0000-000000000002',
  name: 'Norte',
};

describe('WizardEstablishmentComponent: setup y gestión', () => {
  function setup(query: Record<string, string> = {}, initialList = [ACTIVE, OTHER]) {
    const queryParams = new BehaviorSubject(convertToParamMap(query));
    const status = signal<'idle' | 'loading' | 'ready' | 'error'>('loading');
    const active = signal<AccessibleEstablishment | null>(null);
    const navigate = vi.fn().mockResolvedValue(true);
    const listEstablishments = vi.fn(() => of(initialList));
    const load = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({ imports: [WizardEstablishmentComponent] });
    TestBed.overrideComponent(WizardEstablishmentComponent, {
      remove: { imports: [RouterLink] },
    });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: queryParams.value }, queryParamMap: queryParams },
        },
        { provide: Router, useValue: { navigate } },
        {
          provide: EstablishmentContext,
          useValue: { active, status, load },
        },
        {
          provide: SpacesStore,
          useValue: {
            error: signal(null),
            saving: signal(false),
            busy: signal(false),
            strings_: STRINGS.spaces,
            createEstablishment: () => of(ACTIVE),
          },
        },
        {
          provide: SpacesApiService,
          useValue: {
            listEstablishments,
            updateEstablishment: () => of(ACTIVE),
            deleteEstablishment: () => of(null),
          },
        },
      ],
    });

    return { queryParams, status, active, navigate, listEstablishments, load };
  }

  it('espera al contexto si entra cargando y salta directamente a la estructura activa', async () => {
    const { status, active, navigate } = setup();
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(WizardEstablishmentComponent);
    fixture.detectChanges();
    expect(navigate).not.toHaveBeenCalled();

    active.set(ACTIVE);
    status.set('ready');
    TestBed.tick();
    expect(navigate).toHaveBeenCalledWith(['/spaces/floors', ACTIVE.id], { replaceUrl: true });
    fixture.destroy();
  });

  it('conserva acceso a crear y editar establecimientos sin ofrecer selección de contexto', async () => {
    const { queryParams, status, active, listEstablishments } = setup();
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(WizardEstablishmentComponent);
    fixture.detectChanges();
    queryParams.next(convertToParamMap({ manage: '1' }));
    active.set(ACTIVE);
    status.set('ready');
    TestBed.tick();
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(listEstablishments).toHaveBeenCalledOnce();
    expect(page.textContent).toContain(ACTIVE.name);
    expect(page.textContent).toContain(OTHER.name);
    expect(page.querySelectorAll('.est-actions .btn-primary')).toHaveLength(1);

    page.querySelector<HTMLButtonElement>('.chooser > .btn-primary')?.click();
    fixture.detectChanges();
    expect(page.querySelector('form.form')).not.toBeNull();
    expect(page.querySelector('input[name="name"]')).not.toBeNull();
    expect(page.querySelector('select[name="establishment"]')).toBeNull();

    fixture.destroy();
  });

  it('muestra el formulario del primer establecimiento sin el parámetro manage', async () => {
    const { status, listEstablishments, load } = setup({}, []);
    status.set('ready');
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(WizardEstablishmentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(listEstablishments).toHaveBeenCalledOnce();
    expect(page.querySelector('form.form')).not.toBeNull();
    expect(page.querySelector('input[name="name"]')).not.toBeNull();

    const name = page.querySelector<HTMLInputElement>('input[name="name"]')!;
    name.value = 'A1';
    name.dispatchEvent(new Event('input'));
    page.querySelector<HTMLButtonElement>('.type-card')!.click();
    fixture.detectChanges();
    page.querySelector<HTMLFormElement>('form.form')!.dispatchEvent(new Event('submit'));
    expect(load).toHaveBeenCalledOnce();
    fixture.destroy();
  });
});
