import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthSession, type SessionUser } from '@mapit/auth';
import { FeatureFlagService } from '@mapit/feature-flags';
import { MyAccountAccess } from './my-account-access';

describe('MyAccountAccess', () => {
  const user = signal<SessionUser | null>(null);
  const revision = signal(1);
  const evaluations: {
    enabled: ReturnType<typeof signal<boolean>>;
    ready: ReturnType<typeof signal<boolean>>;
    destroy: ReturnType<typeof vi.fn>;
  }[] = [];
  const watch = vi.fn(() => {
    const enabled = signal(false);
    const ready = signal(false);
    const evaluation = { enabled, ready, destroy: vi.fn() };
    evaluations.push(evaluation);
    return evaluation;
  });
  beforeEach(() => {
    evaluations.length = 0;
    watch.mockClear();
    revision.set(1);
    user.set({
      id: 'id-a',
      tenantId: 'tenant-a',
      role: 'STAFF',
      email: 'a@example.com',
      fullName: 'A',
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: { user, revision } },
        { provide: FeatureFlagService, useValue: { watchInContext: watch } },
      ],
    });
  });

  it('espera evaluación propia, sin heredar ON global, y envía el tenant de sesión', () => {
    const access = TestBed.inject(MyAccountAccess);
    expect(access.state()).toEqual({ ready: false, enabled: false });
    TestBed.tick();
    expect(watch).toHaveBeenCalledExactlyOnceWith('mapit.s6.my-account', { tenantId: 'tenant-a' });
    evaluations[0]!.ready.set(true);
    evaluations[0]!.enabled.set(true);
    expect(access.enabled()).toBe(true);
  });

  it('invalida inmediatamente el ámbito anterior incluso con la misma identidad', () => {
    const access = TestBed.inject(MyAccountAccess);
    TestBed.tick();
    evaluations[0]!.enabled.set(true);
    evaluations[0]!.ready.set(true);
    expect(access.enabled()).toBe(true);
    revision.update((value) => value + 1);
    expect(access.state()).toEqual({ ready: false, enabled: false });
    TestBed.tick();
    expect(evaluations[0]!.destroy).toHaveBeenCalledOnce();
    expect(watch).toHaveBeenCalledTimes(2);
    evaluations[0]!.enabled.set(true);
    expect(access.enabled()).toBe(false);
  });

  it('conserva la evaluación al actualizar solo el nombre confirmado', () => {
    const access = TestBed.inject(MyAccountAccess);
    TestBed.tick();
    evaluations[0]!.enabled.set(true);
    user.update((value) => value && { ...value, fullName: 'Nuevo nombre' });
    TestBed.tick();
    expect(access.enabled()).toBe(true);
    expect(watch).toHaveBeenCalledOnce();
  });

  it('destruye el ámbito al salir y no consulta el proxy sin sesión', () => {
    const access = TestBed.inject(MyAccountAccess);
    TestBed.tick();
    user.set(null);
    expect(access.state()).toEqual({ ready: true, enabled: false });
    TestBed.tick();
    expect(evaluations[0]!.destroy).toHaveBeenCalledOnce();
    expect(watch).toHaveBeenCalledOnce();
  });

  it.each(['id', 'tenantId'] as const)(
    'cambiar %s limpia la evaluación sin depender del logout',
    (field) => {
      const access = TestBed.inject(MyAccountAccess);
      TestBed.tick();
      evaluations[0]!.enabled.set(true);
      evaluations[0]!.ready.set(true);
      user.update((value) => value && { ...value, [field]: 'new-value' });
      expect(access.state()).toEqual({ ready: false, enabled: false });
      TestBed.tick();
      expect(evaluations[0]!.destroy).toHaveBeenCalledOnce();
      expect(watch).toHaveBeenLastCalledWith('mapit.s6.my-account', {
        tenantId: field === 'tenantId' ? 'new-value' : 'tenant-a',
      });
      evaluations[0]!.enabled.set(true);
      evaluations[0]!.ready.set(true);
      expect(access.enabled()).toBe(false);
      evaluations[1]!.ready.set(true);
      evaluations[1]!.enabled.set(true);
      expect(access.enabled()).toBe(true);
    },
  );
});
