import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AccessibleEstablishment } from '@mapit/api-client';
import { EstablishmentContext } from '../../../core/establishment-context';
import { CheckInApi } from '../data/check-in-api';
import { CheckInStore } from '../model/check-in-store';
import { QrScanner } from '../model/qr-scanner';
import { CheckIn } from './check-in';

const ACTIVE: AccessibleEstablishment = {
  id: '92000000-0000-0000-0000-000000000001',
  name: 'Centro',
  slug: 'centro',
  address: null,
  timezone: 'America/La_Paz',
  canManagePayments: false,
  canCheckIn: true,
};

describe('CheckIn: contexto operativo', () => {
  it('muestra el activo y cambia de escaneo a entrada manual sin pedir otra selección de local', async () => {
    const active = signal(ACTIVE);
    await TestBed.configureTestingModule({
      imports: [CheckIn],
      providers: [
        {
          provide: EstablishmentContext,
          useValue: { active, status: signal('ready') },
        },
        {
          provide: CheckInApi,
          useValue: {
            preview: signal(false),
            enabled: signal(true),
            authorized: signal(true),
            scenario: signal('ready'),
            publicOrigin: signal('https://mapit.test'),
            watch: () => () => {},
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CheckIn);
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Centro');
    expect(page.querySelector('[data-testid="check-in-venue"]')).toBeNull();
    expect(page.querySelector('[data-testid="check-in-camera"]')).toBeNull();
    expect(page.querySelector('[data-testid="scanner-video"]')).not.toBeNull();
    expect(page.querySelector('.camera-help')).not.toBeNull();
    expect(page.querySelector('.camera-choice')).not.toBeNull();
    expect(page.querySelector('#manual-panel')?.hasAttribute('hidden')).toBe(true);
    const scanTab = page.querySelector<HTMLButtonElement>('[data-testid="check-in-scan-mode"]')!;
    const manualTab = page.querySelector<HTMLButtonElement>(
      '[data-testid="check-in-manual-mode"]',
    )!;
    expect(scanTab.getAttribute('aria-selected')).toBe('true');

    const scanner = fixture.debugElement.injector.get(QrScanner);
    const stop = vi.spyOn(scanner, 'stop');
    scanTab.focus();
    scanTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(stop).toHaveBeenCalledOnce();
    expect(manualTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(manualTab);
    expect(page.querySelector('#manual-panel')?.hasAttribute('hidden')).toBe(false);
    expect(page.querySelector('[data-testid="scanner-video"]')).toBeNull();
    const store = fixture.debugElement.injector.get(CheckInStore);
    store.setInput('temporary-code');
    active.set({ ...ACTIVE, id: '92000000-0000-0000-0000-000000000002', name: 'Norte' });
    TestBed.tick();
    fixture.detectChanges();
    expect(store.input()).toBe('');
    expect(scanTab.getAttribute('aria-selected')).toBe('true');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Norte');
    fixture.destroy();
  });

  it('bloquea la salida durante llegada y confirma cuando hay borrador', async () => {
    await TestBed.configureTestingModule({
      imports: [CheckIn],
      providers: [
        {
          provide: EstablishmentContext,
          useValue: { active: signal(ACTIVE), status: signal('ready') },
        },
        {
          provide: CheckInApi,
          useValue: {
            preview: signal(false),
            enabled: signal(true),
            authorized: signal(true),
            scenario: signal('ready'),
            publicOrigin: signal('https://mapit.test'),
            watch: () => () => {},
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CheckIn);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const store = fixture.debugElement.injector.get(CheckInStore);
    expect(page.canDeactivate()).toBe(true);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    store.setInput('pending-code');
    expect(page.canDeactivate()).toBe(false);
    fixture.destroy();
  });
});
