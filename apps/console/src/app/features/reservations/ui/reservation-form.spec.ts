import { Component, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EstablishmentContext } from '../../../core/establishment-context';
import { ReservationFormStore } from '../model/reservation-form-store';
import { ReservationForm } from './reservation-form';

@Component({
  selector: 'mapit-reservation-customer-picker',
  standalone: true,
  template: '',
})
class CustomerPickerStub {
  readonly personSelected = output<null>();
}

describe('ReservationForm: contexto operativo', () => {
  it('muestra el activo y conserva la creación sin selector local', async () => {
    const store = {
      created: signal(null),
      establishmentName: signal('Centro'),
      establishmentId: signal('active-id'),
      startsAt: signal(''),
      endsAt: signal(''),
      elements: signal([]),
      selectedElementIds: signal(new Set<string>()),
      loading: signal(false),
      submitting: signal(false),
      error: signal(null),
      canSubmit: signal(false),
      isElementSelected: () => false,
      submit: vi.fn(),
      startAnother: vi.fn(),
      setPerson: vi.fn(),
      setStartsAt: vi.fn(),
      setEndsAt: vi.fn(),
      toggleElement: vi.fn(),
      busy: signal(false),
      dirty: signal(false),
    };
    await TestBed.configureTestingModule({ imports: [ReservationForm] })
      .overrideComponent(ReservationForm, {
        set: {
          imports: [CustomerPickerStub],
          providers: [{ provide: ReservationFormStore, useValue: store }],
        },
      })
      .configureTestingModule({
        providers: [
          {
            provide: EstablishmentContext,
            useValue: {
              active: signal({ id: 'active-id', name: 'Centro', timezone: 'America/La_Paz' }),
            },
          },
        ],
      })
      .compileComponents();

    const fixture = TestBed.createComponent(ReservationForm);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Centro');
    expect(page.textContent).toContain('America/La_Paz');
    expect(page.querySelector('select')).toBeNull();
    expect(page.querySelector('input[name="startsAt"]')).not.toBeNull();
    expect(page.querySelector('input[name="endsAt"]')).not.toBeNull();
    expect(page.querySelector('button[type="submit"]')).not.toBeNull();
    fixture.destroy();
  });

  it('usa la guarda para proteger un borrador real', async () => {
    const dirty = signal(false);
    const store = {
      created: signal(null),
      establishmentName: signal('Centro'),
      establishmentId: signal('active-id'),
      startsAt: signal(''),
      endsAt: signal(''),
      elements: signal([]),
      selectedElementIds: signal(new Set<string>()),
      loading: signal(false),
      submitting: signal(false),
      error: signal(null),
      canSubmit: signal(false),
      isElementSelected: () => false,
      submit: vi.fn(),
      startAnother: vi.fn(),
      setPerson: vi.fn(),
      setStartsAt: vi.fn(),
      setEndsAt: vi.fn(),
      toggleElement: vi.fn(),
      busy: signal(false),
      dirty,
    };
    await TestBed.configureTestingModule({ imports: [ReservationForm] })
      .overrideComponent(ReservationForm, {
        set: {
          imports: [CustomerPickerStub],
          providers: [{ provide: ReservationFormStore, useValue: store }],
        },
      })
      .configureTestingModule({
        providers: [{ provide: EstablishmentContext, useValue: { active: signal(null) } }],
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ReservationForm);
    fixture.detectChanges();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(fixture.componentInstance.canDeactivate()).toBe(true);
    dirty.set(true);
    expect(fixture.componentInstance.canDeactivate()).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    fixture.destroy();
  });
});
