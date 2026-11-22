import { AuthSession } from '@mapit/auth';
import { Subject } from 'rxjs';
import { MyAccountApi } from '../data/my-account-api';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MyAccountAccess } from '../../../core/my-account-access';
import { PasswordChangeStore } from './password-change-store';

describe('PasswordChangeStore cambio seguro', () => {
  const scope = signal<string | null>('session-a');
  const enabled = signal(true);
  let store: PasswordChangeStore;
  let response: Subject<void>;
  const revision = signal(1);
  const changePassword = vi.fn();
  const clearIfCurrent = vi.fn();
  beforeEach(() => {
    response = new Subject<void>();
    revision.set(1);
    changePassword.mockReset().mockReturnValue(response);
    clearIfCurrent.mockReset();
    scope.set('session-a');
    enabled.set(true);
    TestBed.configureTestingModule({
      providers: [
        PasswordChangeStore,
        { provide: MyAccountAccess, useValue: { scope, enabled } },
        {
          provide: AuthSession,
          useValue: { revision, token: () => 'private-token', clearIfCurrent },
        },
        { provide: MyAccountApi, useValue: { changePassword } },
      ],
    });
    store = TestBed.inject(PasswordChangeStore);
    TestBed.tick();
  });

  function fill() {
    store.set('currentPassword', 'Anterior1!');
    store.set('newPassword', 'NuevaValida2!');
    store.set('newPasswordConfirm', 'NuevaValida2!');
  }

  it('valida confirmación, reutilización y bytes UTF-8 antes de permitir envío', () => {
    fill();
    expect(store.valid()).toBe(true);
    expect(store.canSubmit()).toBe(true);
    store.set('newPasswordConfirm', 'Otra3!');
    expect(store.mismatch()).toBe(true);
    expect(store.valid()).toBe(false);
    store.set('newPassword', 'Anterior1!');
    expect(store.reused()).toBe(true);
    store.set('currentPassword', 'é'.repeat(37));
    expect(store.currentInvalid()).toBe(true);
  });

  it.each([null, 'other-tenant-session', 'same-user-new-session'])(
    'limpia ante cambio de ámbito: %s',
    (next) => {
      fill();
      scope.set(next);
      expect(store.currentPassword()).toBe('');
      expect(store.newPassword()).toBe('');
      expect(store.confirmation()).toBe('');
      TestBed.tick();
      scope.set('session-a');
      TestBed.tick();
      expect(store.newPassword()).toBe('');
    },
  );

  it('OFF y destrucción eliminan los valores; ON no recupera borradores', () => {
    fill();
    enabled.set(false);
    expect(store.newPassword()).toBe('');
    TestBed.tick();
    enabled.set(true);
    TestBed.tick();
    expect(store.newPassword()).toBe('');
    fill();
    TestBed.resetTestingModule();
    expect(store.currentPassword()).toBe('');
    expect(store.confirmation()).toBe('');
  });
  it('envía una vez, borra secretos, bloquea navegación y exige reautenticación tras 204', () => {
    fill();
    store.submit();
    store.submit();
    expect(changePassword).toHaveBeenCalledExactlyOnceWith({
      currentPassword: 'Anterior1!',
      newPassword: 'NuevaValida2!',
      newPasswordConfirm: 'NuevaValida2!',
    });
    expect(store.saving()).toBe(true);
    expect(store.canDeactivate()).toBe(false);
    expect(store.currentPassword()).toBe('');
    expect(store.confirmation()).toBe('');
    expect(clearIfCurrent).not.toHaveBeenCalled();
    response.next();
    expect(clearIfCurrent).toHaveBeenCalledExactlyOnceWith('private-token');
    expect(store.canDeactivate()).toBe(true);
  });
  it.each([400, 429, 503, 0])(
    'no expone errores ni conserva contraseñas tras HTTP %s',
    (status) => {
      fill();
      store.submit();
      response.error({ status, error: { detail: 'private-canary' } });
      expect(store.saving()).toBe(false);
      expect(store.error()).not.toBe('');
      expect(store.error()).not.toContain('private-canary');
      expect(store.newPassword()).toBe('');
      expect(clearIfCurrent).not.toHaveBeenCalled();
    },
  );
  it.each(['scope', 'revision', 'flag'])('un 204 tardío no cierra otra sesión: %s', (change) => {
    fill();
    store.submit();
    if (change === 'scope') scope.set('tenant-b');
    if (change === 'revision') revision.set(2);
    if (change === 'flag') enabled.set(false);
    response.next();
    expect(clearIfCurrent).not.toHaveBeenCalled();
    TestBed.tick();
    expect(store.currentPassword()).toBe('');
  });
  it('rechaza envío inválido o flag OFF y no escribe en almacenamiento', () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    store.submit();
    expect(changePassword).not.toHaveBeenCalled();
    fill();
    enabled.set(false);
    store.submit();
    expect(changePassword).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    storage.mockRestore();
  });
});
