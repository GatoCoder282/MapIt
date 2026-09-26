import { describe, expect, it } from 'vitest';

import {
  availableStateTransitions,
  canChangeSpaceElementState,
} from './space-element-state-options';

describe('opciones de transición de SpaceElement', () => {
  it('presenta únicamente los destinos válidos para cada estado', () => {
    expect(availableStateTransitions('AVAILABLE')).toEqual([
      'OCCUPIED',
      'RESERVED',
      'OUT_OF_SERVICE',
    ]);
    expect(availableStateTransitions('RESERVED')).toEqual([
      'AVAILABLE',
      'OCCUPIED',
      'OUT_OF_SERVICE',
    ]);
    expect(availableStateTransitions('OCCUPIED')).toEqual([
      'AVAILABLE',
      'CLEANING',
      'OUT_OF_SERVICE',
    ]);
    expect(availableStateTransitions('CLEANING')).toEqual(['AVAILABLE', 'OUT_OF_SERVICE']);
    expect(availableStateTransitions('OUT_OF_SERVICE')).toEqual(['AVAILABLE']);
  });

  it('no ofrece el estado actual como una transición', () => {
    for (const current of [
      'AVAILABLE',
      'OCCUPIED',
      'RESERVED',
      'CLEANING',
      'OUT_OF_SERVICE',
    ] as const) {
      expect(availableStateTransitions(current)).not.toContain(current);
    }
  });

  it('habilita la acción únicamente para ADMIN y STAFF', () => {
    expect(canChangeSpaceElementState('ADMIN')).toBe(true);
    expect(canChangeSpaceElementState('STAFF')).toBe(true);
    expect(canChangeSpaceElementState('MANAGER')).toBe(false);
    expect(canChangeSpaceElementState('SUPER_ADMIN')).toBe(false);
    expect(canChangeSpaceElementState(undefined)).toBe(false);
  });
});
