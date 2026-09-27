import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RealtimeClient, type RealtimeEventEnvelope } from '@mapit/realtime';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpaceElementsRealtime } from './space-elements-realtime';

function event(eventId: string, aggregateVersion: number): RealtimeEventEnvelope {
  return {
    eventId,
    eventType: 'space-element.state.changed.v1',
    schemaVersion: 1,
    occurredAt: '2026-09-27T12:00:00Z',
    establishmentId: 'est-1',
    sectorId: 'sector-1',
    aggregateVersion,
    payload: { spaceElementId: 'el-1', previousState: 'AVAILABLE', state: 'OCCUPIED' },
  };
}

class FakeRealtimeClient {
  readonly connectionState = signal<'idle' | 'connected'>('idle');
  readonly rooms = new Map<string, Subject<RealtimeEventEnvelope>>();
  readonly connect = vi.fn(() => this.connectionState.set('connected'));
  readonly disconnect = vi.fn(() => {
    this.connectionState.set('idle');
    return Promise.resolve();
  });

  subscribeSector(establishmentId: string, sectorId: string): Subject<RealtimeEventEnvelope> {
    const room = new Subject<RealtimeEventEnvelope>();
    this.rooms.set(`${establishmentId}/${sectorId}`, room);
    return room;
  }
}

const flushMicrotasks = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('SpaceElementsRealtime', () => {
  let client: FakeRealtimeClient;
  let service: SpaceElementsRealtime;

  beforeEach(() => {
    client = new FakeRealtimeClient();
    TestBed.configureTestingModule({
      providers: [{ provide: RealtimeClient, useValue: client }],
    });
    service = TestBed.inject(SpaceElementsRealtime);
  });

  it('conecta con la primera suscripción y entrega los eventos de la sala sin duplicados', () => {
    const received: string[] = [];
    const sub = service
      .sectorEvents('est-1', 'sector-1')
      .subscribe((e) => received.push(e.eventId));

    expect(client.connect).toHaveBeenCalledTimes(1);
    const room = client.rooms.get('est-1/sector-1');
    room?.next(event('a', 1));
    room?.next(event('a', 1));
    room?.next(event('b', 2));

    expect(received).toEqual(['a', 'b']);
    sub.unsubscribe();
  });

  it('desconecta cuando se va la última vista', async () => {
    const first = service.sectorEvents('est-1', 'sector-1').subscribe();
    const second = service.sectorEvents('est-1', 'sector-1').subscribe();

    first.unsubscribe();
    await flushMicrotasks();
    expect(client.disconnect).not.toHaveBeenCalled();

    second.unsubscribe();
    await flushMicrotasks();
    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });

  it('no cierra el socket al pasar de un sector a otro en la misma vista', async () => {
    const before = service.sectorEvents('est-1', 'sector-1').subscribe();
    before.unsubscribe();
    const after = service.sectorEvents('est-1', 'sector-2').subscribe();
    await flushMicrotasks();

    // `connect()` es idempotente en RealtimeClient; lo que importa es que no hubo cierre.
    expect(client.disconnect).not.toHaveBeenCalled();
    after.unsubscribe();
  });
});
