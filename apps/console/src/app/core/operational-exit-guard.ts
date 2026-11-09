import type { CanDeactivateFn } from '@angular/router';
import { STRINGS } from './strings';

export interface OperationalPage {
  canDeactivate(): boolean;
}

export function confirmOperationalExit(busy: boolean, dirty: boolean): boolean {
  return !busy && (!dirty || globalThis.confirm(STRINGS.establishmentContext.discardChanges));
}

export const operationalExitGuard: CanDeactivateFn<OperationalPage> = (page) =>
  page.canDeactivate();
