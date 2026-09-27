import { from, lastValueFrom, toArray } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { dedupeRealtimeEvents } from './dedupe';
import type { RealtimeEventEnvelope, SpaceElementState } from './realtime';

function event(
  eventId: string,
  spaceElementId: string,
  aggregateVersion: number,
  state: SpaceElementState = 'OCCUPIED',
): RealtimeEventEnvelope {
  return {
    eventId,
    eventType: 'space-element.state.changed.v1',
    schemaVersion: 1,
    occurredAt: '2026-09-27T12:00:00Z',
    establishmentId: 'est-1',
    sectorId: 'sector-1',
    aggregateVersion,
    payload: { spaceElementId, state },
  };
}

async function run(events: RealtimeEventEnvelope[]): Promise<string[]> {
  const out = await lastValueFrom(from(events).pipe(dedupeRealtimeEvents(), toArray()));
  return out.map((e) => e.eventId);
}

describe('dedupeRealtimeEvents', () => {
  it('descarta el mismo evento recibido dos veces (at-least-once o doble sala)', async () => {
    expect(await run([event('a', 'el-1', 1), event('a', 'el-1', 1)])).toEqual(['a']);
  });

  it('descarta versiones anteriores que llegan tarde', async () => {
    expect(await run([event('b', 'el-1', 2), event('a', 'el-1', 1)])).toEqual(['b']);
  });

  it('lleva la versión por elemento, no global', async () => {
    expect(
      await run([event('a', 'el-1', 3), event('b', 'el-2', 1), event('c', 'el-1', 4)]),
    ).toEqual(['a', 'b', 'c']);
  });
});
