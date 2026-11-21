import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MyAccountAccess } from '../../../core/my-account-access';
import { PasswordChangeStore } from './password-change-store';

describe('PasswordChangeStore preparado sin transporte', () => {
  const scope = signal<string | null>('session-a');
  const enabled = signal(true);
  let store: PasswordChangeStore;
  beforeEach(() => {
    scope.set('session-a');
    enabled.set(true);
    TestBed.configureTestingModule({
      providers: [PasswordChangeStore, { provide: MyAccountAccess, useValue: { scope, enabled } }],
    });
    store = TestBed.inject(PasswordChangeStore);
    TestBed.tick();
  });

  function fill() {
    store.set('currentPassword', 'Anterior1!');
    store.set('newPassword', 'NuevaValida2!');
    store.set('newPasswordConfirm', 'NuevaValida2!');
  }

  it('valida confirmación y reutilización sin habilitar envío, incluso con valores válidos', () => {
    fill();
    expect(store.valid()).toBe(true);
    expect(store.canSubmit).toBe(false);
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
});
