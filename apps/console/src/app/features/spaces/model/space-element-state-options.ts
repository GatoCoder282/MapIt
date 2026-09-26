import type { SpaceElementOperationalState } from '@mapit/api-client';
import type { SessionUser } from '@mapit/auth';

/** Misma matriz operativa de MAP-126, usada para presentar solo acciones válidas. */
export const SPACE_ELEMENT_STATE_TRANSITIONS: Readonly<
  Record<SpaceElementOperationalState, readonly SpaceElementOperationalState[]>
> = {
  AVAILABLE: ['OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'],
  RESERVED: ['AVAILABLE', 'OCCUPIED', 'OUT_OF_SERVICE'],
  OCCUPIED: ['AVAILABLE', 'CLEANING', 'OUT_OF_SERVICE'],
  CLEANING: ['AVAILABLE', 'OUT_OF_SERVICE'],
  OUT_OF_SERVICE: ['AVAILABLE'],
};

export function availableStateTransitions(
  current: SpaceElementOperationalState,
): readonly SpaceElementOperationalState[] {
  return SPACE_ELEMENT_STATE_TRANSITIONS[current];
}

export function canChangeSpaceElementState(role: SessionUser['role'] | undefined): boolean {
  return role === 'ADMIN' || role === 'STAFF';
}
