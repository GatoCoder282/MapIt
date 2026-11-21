import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthSession } from '@mapit/auth';
import type { PersonalProfile } from '@mapit/api-client';
import { I18nService, provideI18n } from '@mapit/i18n';
import { Subject } from 'rxjs';
import { MyAccountAccess } from '../../../core/my-account-access';
import { MyAccountApi } from '../data/my-account-api';
import { MyAccount } from './my-account';

describe('Mi cuenta UI', () => {
  const enabled = signal(true);
  let read: Subject<PersonalProfile>;
  let write: Subject<PersonalProfile>;
  const updateName = vi.fn();

  async function mount() {
    await TestBed.configureTestingModule({
      imports: [MyAccount],
      providers: [
        provideI18n(),
        {
          provide: AuthSession,
          useValue: {
            revision: signal(1),
            warning: signal(''),
            updateFullName: vi.fn(() => true),
          },
        },
        { provide: MyAccountAccess, useValue: { enabled, scope: signal('scope-a') } },
        { provide: MyAccountApi, useValue: { read: () => read, updateName } },
      ],
    }).compileComponents();
    TestBed.inject(I18nService).setLanguage('es');
    const fixture = TestBed.createComponent(MyAccount);
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }
  beforeEach(() => {
    enabled.set(true);
    read = new Subject();
    write = new Subject();
    updateName.mockReset().mockReturnValue(write);
  });

  it('muestra carga, datos reales y correo accesible de solo lectura; guarda y anuncia éxito', async () => {
    const { fixture, host } = await mount();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Cargando');
    read.next({ fullName: 'Ana Real', email: 'ana@example.com' });
    fixture.detectChanges();
    const name = host.querySelector<HTMLInputElement>('#account-name')!;
    const email = host.querySelector<HTMLInputElement>('#account-email')!;
    expect(name.value).toBe('Ana Real');
    expect(email.value).toBe('ana@example.com');
    expect(email.readOnly).toBe(true);
    expect(email.disabled).toBe(false);
    expect(host.querySelector('label[for="account-email"]')?.textContent).toContain('Correo');
    expect(email.getAttribute('aria-describedby')).toBe('email-hint');
    expect(host.querySelector('input[name="contactPhone"]')).toBeNull();
    expect(host.querySelector('select')).toBeNull();
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    name.value = 'Ana Nueva';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(updateName).toHaveBeenCalledExactlyOnceWith('Ana Nueva');
    expect(name.readOnly).toBe(true);
    expect(host.querySelector('form')?.getAttribute('aria-busy')).toBe('true');
    write.next({ fullName: 'Ana Nueva', email: 'ana@example.com' });
    fixture.detectChanges();
    expect(host.querySelector('.save-status')?.textContent).toContain('actualizado');
  });

  it('asocia error de validación al nombre y bloquea guardado inválido', async () => {
    const { fixture, host } = await mount();
    read.next({ fullName: 'Ana', email: 'ana@example.com' });
    fixture.detectChanges();
    const name = host.querySelector<HTMLInputElement>('#account-name')!;
    name.value = ' ';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toContain('name-error');
    expect(host.querySelector('#name-error')).not.toBeNull();
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(updateName).not.toHaveBeenCalled();
  });

  it('muestra error anunciado, permite reintentar y traduce estados sin recargar', async () => {
    const { fixture, host } = await mount();
    read.error(new Error('private backend detail'));
    fixture.detectChanges();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('No se pudo cargar');
    expect(host.textContent).not.toContain('private backend detail');
    expect(host.querySelector('button')?.textContent).toContain('Volver a cargar');
    TestBed.inject(I18nService).setLanguage('en');
    fixture.detectChanges();
    expect(host.querySelector('h1')?.textContent).toBe('My account');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
    TestBed.inject(I18nService).setLanguage('ja-JP');
    fixture.detectChanges();
    expect(host.querySelector('h1')?.textContent).toBe('マイアカウント');
    expect(host.querySelector('button')?.textContent).toContain('再読み込み');
    TestBed.inject(I18nService).setLanguage('es');
  });

  it('retira formulario y datos inmediatamente al apagar la flag', async () => {
    const { fixture, host } = await mount();
    read.next({ fullName: 'Ana', email: 'ana@example.com' });
    fixture.detectChanges();
    enabled.set(false);
    fixture.detectChanges();
    expect(host.querySelector('form')).toBeNull();
    expect(host.textContent).not.toContain('ana@example.com');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('no está disponible');
  });
});
