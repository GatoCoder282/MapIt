import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CheckInApi } from '../data/check-in-api';
import { CheckInStore } from '../model/check-in-store';
import { CheckIn } from './check-in';

describe('CheckIn: selección local', () => {
  it('permite elegir un local autorizado dentro de recepción sin contexto global', async () => {
    const id = signal('92000000-0000-0000-0000-000000000001');
    let resolveVenues!: (value: { id: string; name: string }[]) => void;
    const pending = new Promise<{ id: string; name: string }[]>(
      (resolve) => (resolveVenues = resolve),
    );
    const watch = vi.fn(() => () => {});
    await TestBed.configureTestingModule({
      imports: [CheckIn],
      providers: [
        {
          provide: CheckInApi,
          useValue: {
            preview: signal(false),
            enabled: signal(true),
            authorized: signal(true),
            publicOrigin: signal('https://mapit.test'),
            scenario: signal('ready'),
            establishments: () => pending,
            watch,
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CheckIn);
    fixture.detectChanges();
    const store = fixture.debugElement.injector.get(CheckInStore);
    expect(store.establishmentId()).toBe('');
    resolveVenues([
      { id: '92000000-0000-0000-0000-000000000002', name: 'Centro' },
      { id: id(), name: 'Norte' },
    ]);
    await pending;
    await Promise.resolve();
    fixture.detectChanges();
    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '[data-testid="check-in-venue"]',
    )!;
    expect(select.disabled).toBe(false);
    select.value = id();
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(store.establishmentId()).toBe(id());
    fixture.destroy();
  });
});
