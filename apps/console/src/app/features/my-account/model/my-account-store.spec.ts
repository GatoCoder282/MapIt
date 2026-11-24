import { HttpErrorResponse } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthSession, type SessionUser } from '@mapit/auth';
import type { PersonalProfile } from '@mapit/api-client';
import { I18nService } from '@mapit/i18n';
import { Subject } from 'rxjs';
import { MyAccountAccess } from '../../../core/my-account-access';
import { MyAccountApi } from '../data/my-account-api';
import { MyAccountStore } from './my-account-store';

const profile = {
  fullName: 'Nombre real',
  email: 'real@example.com',
  contactPhone: null,
  preferredLanguage: null,
};

describe('MyAccountStore', () => {
  let read: Subject<PersonalProfile>;
  let write: Subject<PersonalProfile>;
  const revision = signal(1);
  const user = signal<SessionUser | null>(null);
  const enabled = signal(true);
  const updateFullName = vi.fn(() => true);
  const api = { read: vi.fn(), update: vi.fn() };
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
    api.update.mockReset().mockImplementation(() => write);
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
    TestBed.inject(I18nService).setLanguage('es');
    TestBed.tick();
  });

  afterEach(() => TestBed.inject(I18nService).setLanguage('es'));

  it('carga teléfono e idioma persistidos sin sobrescribir la preferencia local al leer', () => {
    read.next({ ...profile, contactPhone: '+591 123', preferredLanguage: 'ja-JP' });
    expect(store.phoneDraft()).toBe('+591 123');
    expect(store.languageDraft()).toBe('ja-JP');
    expect(TestBed.inject(I18nService).language()).toBe('es');
    expect(store.dirty()).toBe(false);
    store.setName('Solo nombre');
    store.save();
    expect(api.update).toHaveBeenCalledExactlyOnceWith({ fullName: 'Solo nombre' });
  });

  it('guarda solo campos cambiados y aplica idioma tras ACK de la misma sesión', () => {
    read.next(profile);
    store.setPhone('+591 (2) 123');
    store.setLanguage('ja-JP');
    store.save();
    expect(api.update).toHaveBeenCalledExactlyOnceWith({
      contactPhone: '+591 (2) 123',
      preferredLanguage: 'ja-JP',
    });
    expect(TestBed.inject(I18nService).language()).toBe('es');
    write.next({ ...profile, contactPhone: '+591 (2) 123', preferredLanguage: 'ja-JP' });
    expect(store.saved()).toBe(true);
    expect(store.dirty()).toBe(false);
    expect(TestBed.inject(I18nService).language()).toBe('ja-JP');
  });

  it('restaura borradores y limpia opcionales con null sin resetear el idioma local', () => {
    TestBed.inject(I18nService).setLanguage('en');
    read.next({ ...profile, contactPhone: '123', preferredLanguage: 'ja-JP' });
    store.setPhone('');
    store.setLanguage('');
    store.reset();
    expect(store.phoneDraft()).toBe('123');
    expect(store.languageDraft()).toBe('ja-JP');
    expect(store.dirty()).toBe(false);
    store.setPhone('');
    store.setLanguage('');
    store.save();
    expect(api.update).toHaveBeenCalledExactlyOnceWith({
      contactPhone: null,
      preferredLanguage: null,
    });
    write.next(profile);
    expect(store.saved()).toBe(true);
    expect(TestBed.inject(I18nService).language()).toBe('en');
  });

  it('una elección local posterior prevalece sobre la respuesta de guardado', () => {
    read.next(profile);
    store.setLanguage('ja-JP');
    store.save();
    TestBed.inject(I18nService).setLanguage('en');
    write.next({ ...profile, preferredLanguage: 'ja-JP' });
    expect(store.profile()?.preferredLanguage).toBe('ja-JP');
    expect(TestBed.inject(I18nService).language()).toBe('en');
  });

  it('conserva contacto e idioma sin aplicarlos cuando falla el guardado', () => {
    read.next(profile);
    store.setPhone('123');
    store.setLanguage('ja-JP');
    store.save();
    write.error(new HttpErrorResponse({ status: 503 }));
    expect(store.phoneDraft()).toBe('123');
    expect(store.languageDraft()).toBe('ja-JP');
    expect(store.saving()).toBe(false);
    expect(store.saved()).toBe(false);
    expect(store.error()).not.toBe('');
    expect(TestBed.inject(I18nService).language()).toBe('es');
    expect(updateFullName).not.toHaveBeenCalled();
  });

  it('descarta idioma/teléfono y respuesta anterior al cambiar de sesión', () => {
    read.next({ ...profile, contactPhone: '123', preferredLanguage: 'en' });
    store.setLanguage('ja-JP');
    store.save();
    revision.update((value) => value + 1);
    user.update((value) => (value ? { ...value, id: 'b', tenantId: 'tenant-b' } : null));
    expect(store.phoneDraft()).toBe('');
    expect(store.languageDraft()).toBe('');
    write.next({ ...profile, contactPhone: '999', preferredLanguage: 'ja-JP' });
    expect(TestBed.inject(I18nService).language()).toBe('es');
    expect(updateFullName).not.toHaveBeenCalled();
    read = new Subject();
    TestBed.tick();
    read.next({ ...profile, contactPhone: '456', preferredLanguage: 'en' });
    expect(store.phoneDraft()).toBe('456');
    expect(TestBed.inject(I18nService).language()).toBe('es');
  });

  it.each(['abc', '123\n', '1'.repeat(33), '１２３', '+--', ' '])(
    'rechaza teléfono inválido sin enviar PATCH: %j',
    (phone) => {
      read.next(profile);
      store.setPhone(phone);
      expect(store.phoneValid()).toBe(false);
      store.save();
      expect(api.update).not.toHaveBeenCalled();
    },
  );

  it('rechaza idioma no soportado y respuestas sin campos persistidos, sin simular valores', () => {
    read.next({ fullName: 'Servidor antiguo', email: 'old@example.com' } as PersonalProfile);
    expect(store.profile()).toBeNull();
    expect(store.error()).not.toBe('');
    read = new Subject();
    store.load();
    read.next(profile);
    store.setLanguage('fr');
    store.save();
    expect(api.update).not.toHaveBeenCalled();
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
    expect(api.update).toHaveBeenCalledExactlyOnceWith({ fullName: 'Nuevo nombre' });
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
      expect(api.update).not.toHaveBeenCalled();
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
      read.next({
        fullName: 'Nueva cuenta',
        email: 'other@example.com',
        contactPhone: null,
        preferredLanguage: null,
      });
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
    expect(api.update).not.toHaveBeenCalled();
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

  it('rollback durante PATCH descarta el resultado y ON vuelve a leer el valor persistido', () => {
    read.next(profile);
    store.setName('En curso');
    store.save();
    enabled.set(false);
    expect(store.profile()).toBeNull();
    write.next({ ...profile, fullName: 'En curso' });
    expect(updateFullName).not.toHaveBeenCalled();
    TestBed.tick();
    expect(store.saved()).toBe(false);
    read = new Subject();
    enabled.set(true);
    TestBed.tick();
    expect(store.loading()).toBe(true);
    expect(store.draft()).toBe('');
    read.next({ ...profile, fullName: 'Valor realmente persistido' });
    expect(store.draft()).toBe('Valor realmente persistido');
    expect(store.saved()).toBe(false);
    expect(store.dirty()).toBe(false);
  });
});
