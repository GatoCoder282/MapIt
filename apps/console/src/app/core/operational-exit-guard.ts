import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { AuthSession } from '@mapit/auth';
import { STRINGS } from './strings';

export interface OperationalPage {
  canDeactivate(): boolean | Promise<boolean>;
}

export function confirmOperationalExit(busy: boolean, dirty: boolean): boolean {
  return !busy && (!dirty || globalThis.confirm(STRINGS.establishmentContext.discardChanges));
}

export const operationalExitGuard: CanDeactivateFn<OperationalPage> = (
  page,
  _route,
  _state,
  nextState,
) => {
  const session = inject(AuthSession);
  if (!session.user() && nextState.url === session.loginUrl()) return true;
  return page.canDeactivate();
};
