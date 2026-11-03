import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LucideInfo, LucideLayoutGrid } from '@lucide/angular';
import type { RealtimeConnectionState, SpaceElementState } from '@mapit/realtime';

import { I18nService, LocalizedNumberPipe } from '@mapit/i18n';
import { STRINGS } from '../../../../core/strings';

/**
 * Orden de los estados en el panel: el mismo que el mapa y el de las cinco
 * claves del contrato (`byState`). El estado disponible abre y el que se apaga
 * por completo cierra.
 *
 * La lista la define el componente; los conteos llegan en el registro.
 */
const STATE_ORDER: readonly SpaceElementState[] = [
  'AVAILABLE',
  'OCCUPIED',
  'RESERVED',
  'CLEANING',
  'OUT_OF_SERVICE',
];

/**
 * Panel "Ocupación en vivo" (CU-10, v7).
 *
 * Componente presentacional: recibe los conteos ya calculados por el store y
 * solo los dibuja. El indicador de conexión NO adorna: dice la verdad —
 * "En vivo" solo cuando el socket está conectado, y cuando no lo está dice
 * que lo que se ve es una instantánea.
 *
 * Los cinco estados están siempre presentes, con 0 cuando no hay elementos en
 * ese estado: una fila que desaparece no se distingue de una que no se ha
 * dibujado.
 */
@Component({
  selector: 'mapit-occupancy-panel',
  imports: [LocalizedNumberPipe, LucideInfo, LucideLayoutGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './occupancy-panel.html',
  styleUrl: './occupancy-panel.scss',
})
export class OccupancyPanel {
  protected readonly locale = inject(I18nService).locale;
  /** Conteo por estado. Las cinco claves del contrato; una que falte es 0. */
  readonly counts = input<Readonly<Partial<Record<SpaceElementState, number>>>>({});
  /** Total de elementos del tenant (la suma de los cinco estados). */
  readonly total = input(0);
  /** Carga en curso: se dibuja el esqueleto y no el total. */
  readonly loading = input(false);
  /** El resumen falló: se muestra el error con su reintento. */
  readonly failed = input(false);
  /** Estado de la conexión en vivo (STOMP). */
  readonly connection = input<RealtimeConnectionState>('idle');
  /** Pide un reintento del resumen. */
  readonly retry = output<void>();

  protected readonly strings = STRINGS.adminDashboardHome;

  /** Una fila por estado, siempre las cinco. */
  protected readonly rows = computed(() =>
    STATE_ORDER.map((state) => ({
      state,
      label: this.strings.occupancyStates[state],
      count: this.counts()[state] ?? 0,
    })),
  );

  /** ¿Los datos llegan en vivo? Solo con el socket conectado. */
  protected readonly isLive = computed(() => this.connection() === 'connected');

  /** Texto del chip de conexión. Nunca dice "En vivo" si no lo está. */
  protected readonly connectionLabel = computed(() => {
    switch (this.connection()) {
      case 'connected':
        return this.strings.occupancyLive;
      case 'connecting':
        return this.strings.occupancyConnecting;
      case 'disconnected':
        return this.strings.occupancyDisconnected;
      case 'error':
        return this.strings.occupancyConnectionError;
      default:
        // 'disabled' (flag `realtime.websocket` apagada) e 'idle' (aún no
        // conectado): en los dos casos lo que se ve es una instantánea.
        return this.strings.occupancySnapshot;
    }
  });

  /**
   * Nota que explica el panel cuando no hay directo. `null` cuando sí lo hay:
   * no hay nada que explicar de una conexión en vivo.
   */
  protected readonly connectionNote = computed(() => {
    switch (this.connection()) {
      case 'connected':
        return null;
      case 'connecting':
        return this.strings.occupancyConnectingNote;
      case 'disconnected':
        return this.strings.occupancyDisconnectedNote;
      case 'error':
        return this.strings.occupancyConnectionErrorNote;
      case 'disabled':
        return this.strings.occupancyDisabledNote;
      default:
        return this.strings.occupancyIdleNote;
    }
  });
}
