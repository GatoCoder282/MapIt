import { inject, Injectable, type Signal } from '@angular/core';
import {
  RealtimeClient,
  dedupeRealtimeEvents,
  type RealtimeConnectionState,
  type RealtimeEventEnvelope,
} from '@mapit/realtime';
import { defer, finalize, type Observable } from 'rxjs';

/**
 * Capa de datos del tiempo real de elementos espaciales (HU-3.02 / MAP-148).
 *
 * <p>Envuelve `RealtimeClient` (HUT-01) para que la UI no toque STOMP: abre la conexión con la
 * primera vista que escucha un sector y la cierra con la última. La reconexión con backoff, el JWT
 * en `CONNECT` y el kill switch ya los resuelve el cliente de la librería.
 */
@Injectable({ providedIn: 'root' })
export class SpaceElementsRealtime {
  private readonly client = inject(RealtimeClient);
  private watchers = 0;

  readonly connectionState: Signal<RealtimeConnectionState> = this.client.connectionState;

  /** Eventos de estado del sector, ya deduplicados por elemento y versión. */
  sectorEvents(establishmentId: string, sectorId: string): Observable<RealtimeEventEnvelope> {
    return defer(() => {
      this.watchers += 1;
      if (this.watchers === 1) this.client.connect();
      return this.client.subscribeSector(establishmentId, sectorId).pipe(dedupeRealtimeEvents());
    }).pipe(finalize(() => this.release()));
  }

  private release(): void {
    this.watchers -= 1;
    // Al cambiar de sector, `switchMap` suelta la sala anterior antes de pedir la nueva. Diferir el
    // cierre una microtarea evita cerrar y reabrir el socket en ese hueco.
    queueMicrotask(() => {
      if (this.watchers === 0) void this.client.disconnect();
    });
  }
}
