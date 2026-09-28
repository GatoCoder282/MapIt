import { filter, type MonoTypeOperatorFunction } from 'rxjs';
import type { RealtimeEventEnvelope } from './realtime';

/**
 * Deduplicación que el contrato v1 asigna al consumidor (`docs/api/realtime.md`).
 *
 * <p>La entrega es at-least-once y un evento de sector llega también por la sala del
 * establecimiento. Por cada elemento se recuerda la última `aggregateVersion` aplicada y se
 * descarta cualquier evento con versión igual (duplicado) o menor (llegó tarde). El estado vive
 * por suscripción: dos consumidores no comparten memoria.
 */
export function dedupeRealtimeEvents(): MonoTypeOperatorFunction<RealtimeEventEnvelope> {
  return (source) => {
    const lastVersion = new Map<string, number>();
    return source.pipe(
      filter((event) => {
        const elementId = event.payload.spaceElementId;
        const previous = lastVersion.get(elementId);
        if (previous !== undefined && event.aggregateVersion <= previous) return false;
        lastVersion.set(elementId, event.aggregateVersion);
        return true;
      }),
    );
  };
}
