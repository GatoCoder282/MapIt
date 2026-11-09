import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { confirmOperationalExit, operationalExitGuard } from './operational-exit-guard';
import { routes } from '../app.routes';

describe('operational exit protection', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  afterEach(() => vi.restoreAllMocks());

  it('permite salir con formulario limpio sin preguntar', () => {
    const confirm = vi.spyOn(globalThis, 'confirm');
    expect(confirmOperationalExit(false, false)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('mantiene borrador y ruta si se rechaza descartarlo', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    expect(confirmOperationalExit(false, true)).toBe(false);
  });

  it('permite descartar un borrador tras confirmación', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    expect(confirmOperationalExit(false, true)).toBe(true);
  });

  it('bloquea toda salida durante una escritura sin ofrecer descarte', () => {
    const confirm = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    expect(confirmOperationalExit(true, false)).toBe(false);
    expect(confirmOperationalExit(true, true)).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('delega la guarda al estado actual de la pantalla', () => {
    const page = { canDeactivate: vi.fn(() => false) };
    expect(operationalExitGuard(page, route, state, state)).toBe(false);
    page.canDeactivate.mockReturnValue(true);
    expect(operationalExitGuard(page, route, state, state)).toBe(true);
  });

  it('protege rutas operativas sin imponer establecimiento a plataforma', () => {
    const staff = routes.find((entry) => entry.path === '' && entry.children);
    for (const path of [
      'reservations/new',
      'check-in',
      'administration/settings/payment-methods',
    ]) {
      expect(staff?.children?.find((entry) => entry.path === path)?.canDeactivate).toContain(
        operationalExitGuard,
      );
    }
    const platform = routes.find((entry) => entry.path === 'admin');
    expect(platform?.canDeactivate).toBeUndefined();
    expect(platform?.children?.every((entry) => !entry.canDeactivate)).toBe(true);
  });
});
