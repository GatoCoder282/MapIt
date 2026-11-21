import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService, provideI18n } from '@mapit/i18n';
import { MyAccountAccess } from '../../../core/my-account-access';
import { PasswordChangeForm } from './password-change-form';

describe('PasswordChangeForm no operativo', () => {
  async function mount() {
    await TestBed.configureTestingModule({
      imports: [PasswordChangeForm],
      providers: [
        provideI18n(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MyAccountAccess,
          useValue: { scope: signal('session-a'), enabled: signal(true) },
        },
      ],
    }).compileComponents();
    TestBed.inject(I18nService).setLanguage('es');
    const fixture = TestBed.createComponent(PasswordChangeForm);
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  it('prepara controles accesibles y confirmación, sin HTTP ni persistencia incluso en submit forzado', async () => {
    const { fixture, host } = await mount();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const inputs = host.querySelectorAll<HTMLInputElement>('input');
    expect(inputs).toHaveLength(3);
    for (const input of inputs) {
      expect(input.type).toBe('password');
      expect(host.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
      input.value = input.name === 'currentPassword' ? 'Anterior1!' : 'NuevaValida2!';
      input.dispatchEvent(new Event('input'));
    }
    expect(inputs[0]?.autocomplete).toBe('current-password');
    expect(inputs[1]?.autocomplete).toBe('new-password');
    fixture.detectChanges();
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    host.querySelector('form')!.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
    TestBed.inject(HttpTestingController).expectNone(() => true);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
    inputs[2]!.value = 'Diferente3!';
    inputs[2]!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(inputs[2]?.getAttribute('aria-invalid')).toBe('true');
    expect(inputs[2]?.getAttribute('aria-describedby')).toBe('password-mismatch');
    expect(host.querySelector('#password-mismatch')).not.toBeNull();
    host.querySelector<HTMLButtonElement>('button[type="button"]')!.click();
    fixture.detectChanges();
    expect([...inputs].every((input) => input.value === '')).toBe(true);
  });

  it('traduce etiquetas y disponibilidad a los tres idiomas', async () => {
    const { fixture, host } = await mount();
    expect(host.querySelector('h2')?.textContent).toBe('Cambiar contraseña');
    const i18n = TestBed.inject(I18nService);
    i18n.setLanguage('en');
    fixture.detectChanges();
    expect(host.querySelector('h2')?.textContent).toBe('Change password');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('not available');
    i18n.setLanguage('ja-JP');
    fixture.detectChanges();
    expect(host.querySelector('h2')?.textContent).toBe('パスワードの変更');
    i18n.setLanguage('es');
  });
});
