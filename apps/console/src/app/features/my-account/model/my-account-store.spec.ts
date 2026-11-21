import { HttpErrorResponse } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthSession, type SessionUser } from '@mapit/auth';
import type { PersonalProfile } from '@mapit/api-client';
import { Subject } from 'rxjs';
import { MyAccountAccess } from '../../../core/my-account-access';
import { MyAccountApi } from '../data/my-account-api';
import { MyAccountStore } from './my-account-store';

const profile = { fullName: 'Nombre real', email: 'real@example.com' };

describe('MyAccountStore', () => {
  let read: Subject<PersonalProfile>;
  let write: Subject<PersonalProfile>;
  const revision = signal(1);
  const user = signal<SessionUser | null>(null);
  const enabled = signal(true);
  const updateFullName = vi.fn(() => true);
  const api = { read: vi.fn(), updateName: vi.fn() };
  let store: MyAccountStore;

  beforeEach(() => {
    read = new Subject();
    write = new Subject();
    revision.set(1);
    user.set({
      id: 'a',
      tenantId: 'tenant-a',
      fullName: 'Anterior',
      email: profile.email,
      role: 'STAFF',
    });
    enabled.set(true);
    updateFullName.mockClear();
    api.read.mockReset().mockImplementation(() => read);
    api.updateName.mockReset().mockImplementation(() => write);
    TestBed.configureTestingModule({
      providers: [
        MyAccountStore,
        { provide: AuthSession, useValue: { user, revision, warning: signal(''), updateFullName } },
        {
          provide: MyAccountAccess,
          useValue: {
            enabled,
            scope: computed(() =>
              user() ? JSON.stringify([revision(), user()?.id, user()?.tenantId]) : null,
            ),
          },
        },
        { provide: MyAccountApi, useValue: api },
      ],
    });
    store = TestBed.inject(MyAccountStore);
    TestBed.tick();
  });

  it('carga solo datos del backend, sin usar el nombre de la sesión como perfil', () => {
    expect(store.loading()).toBe(true);
    expect(store.profile()).toBeNull();
    read.next(profile);
    expect(store.profile()).toEqual(profile);
    expect(store.draft()).toBe(profile.fullName);
    expect(store.loading()).toBe(false);
    expect(store.canSave()).toBe(false);
  });

  it('guarda una vez y sincroniza solo el nombre confirmado por backend', () => {
    read.next(profile);
    store.setName('  Nuevo nombre  ');
    store.save();
    store.save();
    store.setName('Otra edición');
    expect(api.updateName).toHaveBeenCalledExactlyOnceWith('Nuevo nombre');
    expect(store.saving()).toBe(true);
    expect(updateFullName).not.toHaveBeenCalled();
    expect(store.canDeactivate()).toBe(false);
    write.next({ ...profile, fullName: 'Nombre confirmado' });
    expect(updateFullName).toHaveBeenCalledExactlyOnceWith('Nombre confirmado', 1);
    expect(store.draft()).toBe('Nombre confirmado');
    expect(store.saved()).toBe(true);
    expect(store.dirty()).toBe(false);
    expect(store.canDeactivate()).toBe(true);
  });

  it.each(['', '   ', 'a'.repeat(121), 'Nombre\napellido', 'a\rb'])(
    'rechaza nombre inválido: %j',
    (name) => {
      read.next(profile);
      store.setName(name);
      store.save();
      expect(store.valid()).toBe(false);
      expect(api.updateName).not.toHaveBeenCalled();
    },
  );

  it('cuenta caracteres Unicode como el contrato y permite descartar el borrador', () => {
    read.next(profile);
    store.setName('𠮷'.repeat(120));
    expect(store.valid()).toBe(true);
    const confirm = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    expect(store.canDeactivate()).toBe(false);
    confirm.mockRestore();
    store.reset();
    expect(store.dirty()).toBe(false);
  });

  it('muestra fallo de lectura seguro y permite reintentar', () => {
    read.error(new HttpErrorResponse({ status: 500, error: { detail: 'sensitive' } }));
    expect(store.loading()).toBe(false);
    expect(store.error()).toContain('cargar');
    expect(store.error()).not.toContain('sensitive');
    read = new Subject();
    store.load();
    read.next(profile);
    expect(store.profile()).toEqual(profile);
    expect(store.error()).toBe('');
  });

  it('conserva el borrador y la sesión cuando falla PATCH', () => {
    read.next(profile);
    store.setName('Nuevo');
    store.save();
    write.error(new HttpErrorResponse({ status: 503 }));
    expect(store.saving()).toBe(false);
    expect(store.saved()).toBe(false);
    expect(store.draft()).toBe('Nuevo');
    expect(store.canSave()).toBe(true);
    expect(updateFullName).not.toHaveBeenCalled();
  });

  it.each(['id', 'tenant', 'session'] as const)(
    'descarta datos/borradores/respuestas al cambiar %s',
    (kind) => {
      read.next(profile);
      store.setName('Nuevo');
      store.save();
      const oldRead = read;
      const oldWrite = write;
      read = new Subject();
      revision.update((value) => value + 1);
      if (kind === 'id') user.update((value) => value && { ...value, id: 'other' });
      if (kind === 'tenant') user.update((value) => value && { ...value, tenantId: 'other' });
      // El enmascaramiento ocurre antes de ejecutar los efectos de limpieza.
      expect(store.profile()).toBeNull();
      expect(store.draft()).toBe('');
      oldWrite.next({ ...profile, fullName: 'Obsoleto' });
      oldRead.next(profile);
      expect(updateFullName).not.toHaveBeenCalled();
      TestBed.tick();
      read.next({ fullName: 'Nueva cuenta', email: 'other@example.com' });
      expect(store.profile()?.email).toBe('other@example.com');
      expect(store.saved()).toBe(false);
    },
  );

  it('OFF limpia el perfil, bloquea escrituras y ON carga de nuevo', () => {
    read.next(profile);
    store.setName('Nuevo');
    enabled.set(false);
    expect(store.profile()).toBeNull();
    store.save();
    TestBed.tick();
    expect(api.updateName).not.toHaveBeenCalled();
    read = new Subject();
    enabled.set(true);
    TestBed.tick();
    expect(api.read).toHaveBeenCalledTimes(2);
    read.next(profile);
    expect(store.draft()).toBe(profile.fullName);
  });

  it('logout elimina los datos y no vuelve a consultar', () => {
    read.next(profile);
    user.set(null);
    revision.update((value) => value + 1);
    expect(store.profile()).toBeNull();
    TestBed.tick();
    store.load();
    expect(api.read).toHaveBeenCalledTimes(1);
  });
});
