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
  const update = vi.fn();

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
        { provide: MyAccountApi, useValue: { read: () => read, update } },
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
    update.mockReset().mockReturnValue(write);
  });

  it('muestra carga, datos reales y correo accesible de solo lectura; guarda y anuncia éxito', async () => {
    const { fixture, host } = await mount();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Cargando');
    read.next({
      fullName: 'Ana Real',
      email: 'ana@example.com',
      contactPhone: null,
      preferredLanguage: null,
    });
    fixture.detectChanges();
    const name = host.querySelector<HTMLInputElement>('#account-name')!;
    const email = host.querySelector<HTMLInputElement>('#account-email')!;
    expect(name.value).toBe('Ana Real');
    expect(email.value).toBe('ana@example.com');
    expect(email.readOnly).toBe(true);
    expect(email.disabled).toBe(false);
    expect(host.querySelector('label[for="account-email"]')?.textContent).toContain('Correo');
    expect(email.getAttribute('aria-describedby')).toBe('email-hint');
    expect(host.querySelector('input[name="contactPhone"]')).not.toBeNull();
    expect(host.querySelector('mapit-password-change-form')).not.toBeNull();
    expect(host.querySelectorAll('input[type="password"]')).toHaveLength(3);
    expect(host.querySelector('select')?.getAttribute('name')).toBe('preferredLanguage');
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    name.value = 'Ana Nueva';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(update).toHaveBeenCalledExactlyOnceWith({ fullName: 'Ana Nueva' });
    expect(name.readOnly).toBe(true);
    expect(host.querySelector('form')?.getAttribute('aria-busy')).toBe('true');
    write.next({
      fullName: 'Ana Nueva',
      email: 'ana@example.com',
      contactPhone: null,
      preferredLanguage: null,
    });
    fixture.detectChanges();
    expect(host.querySelector('.save-status')?.textContent).toContain('actualizado');
  });

  it('asocia error de validación al nombre y bloquea guardado inválido', async () => {
    const { fixture, host } = await mount();
    read.next({
      fullName: 'Ana',
      email: 'ana@example.com',
      contactPhone: null,
      preferredLanguage: null,
    });
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
    expect(update).not.toHaveBeenCalled();
  });

  it('edita contacto e idioma accesibles y confirma persistencia antes de cambiar idioma', async () => {
    const { fixture, host } = await mount();
    read.next({
      fullName: 'Ana',
      email: 'ana@example.com',
      contactPhone: '123',
      preferredLanguage: null,
    });
    fixture.detectChanges();
    const phone = host.querySelector<HTMLInputElement>('#account-phone')!;
    const language = host.querySelector<HTMLSelectElement>('#account-language')!;
    expect(phone.type).toBe('tel');
    expect(phone.maxLength).toBe(32);
    expect(phone.value).toBe('123');
    expect([...language.options].map((option) => option.value)).toEqual(['', 'es', 'en', 'ja-JP']);
    expect(host.querySelector('label[for="account-phone"]')).not.toBeNull();
    expect(language.getAttribute('aria-describedby')).toBe('language-hint');
    phone.value = '+591 456';
    phone.dispatchEvent(new Event('input'));
    language.value = 'ja-JP';
    language.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(update).toHaveBeenCalledExactlyOnceWith({
      contactPhone: '+591 456',
      preferredLanguage: 'ja-JP',
    });
    expect(phone.readOnly).toBe(true);
    expect(language.disabled).toBe(true);
    expect(TestBed.inject(I18nService).language()).toBe('es');
    write.next({
      fullName: 'Ana',
      email: 'ana@example.com',
      contactPhone: '+591 456',
      preferredLanguage: 'ja-JP',
    });
    fixture.detectChanges();
    expect(TestBed.inject(I18nService).language()).toBe('ja-JP');
    expect(language.disabled).toBe(false);
    TestBed.inject(I18nService).setLanguage('es');
  });

  it('anuncia un teléfono inválido sin marcar el nombre válido como error', async () => {
    const { fixture, host } = await mount();
    read.next({
      fullName: 'Ana',
      email: 'ana@example.com',
      contactPhone: null,
      preferredLanguage: null,
    });
    fixture.detectChanges();
    const phone = host.querySelector<HTMLInputElement>('#account-phone')!;
    phone.value = 'abc';
    phone.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(phone.getAttribute('aria-invalid')).toBe('true');
    expect(phone.getAttribute('aria-describedby')).toContain('phone-error');
    expect(
      host.querySelector<HTMLInputElement>('#account-name')!.getAttribute('aria-invalid'),
    ).toBe('false');
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
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
    read.next({
      fullName: 'Ana',
      email: 'ana@example.com',
      contactPhone: null,
      preferredLanguage: null,
    });
    fixture.detectChanges();
    enabled.set(false);
    fixture.detectChanges();
    expect(host.querySelector('form')).toBeNull();
    expect(host.textContent).not.toContain('ana@example.com');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('no está disponible');
  });

  it('protege la salida con borradores y mientras se confirma el cambio de contraseña', async () => {
    const response = new Subject<void>();
    const changePassword = vi.fn(() => response);
    const clearIfCurrent = vi.fn();
    const { fixture, host } = await mount();
    Object.assign(TestBed.inject(MyAccountApi), { changePassword });
    Object.assign(TestBed.inject(AuthSession), { token: () => 'current-token', clearIfCurrent });
    read.next({
      fullName: 'Ana',
      email: 'ana@example.com',
      contactPhone: null,
      preferredLanguage: null,
    });
    fixture.detectChanges();
    for (const input of host.querySelectorAll<HTMLInputElement>('input[type="password"]')) {
      input.value = input.name === 'currentPassword' ? 'Anterior1!' : 'NuevaValida2!';
      input.dispatchEvent(new Event('input'));
    }
    const confirm = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    expect(fixture.componentInstance.canDeactivate()).toBe(false);
    confirm.mockRestore();
    host
      .querySelector('mapit-password-change-form form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.canDeactivate()).toBe(false);
    response.next();
    fixture.detectChanges();
    expect(clearIfCurrent).toHaveBeenCalledExactlyOnceWith('current-token');
    expect(fixture.componentInstance.canDeactivate()).toBe(true);
  });
});
