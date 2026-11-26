import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { GuardedCount } from '@mapit/api-client';
import { I18nService, LocalizedDatePipe, LocalizedNumberPipe } from '@mapit/i18n';

import { STRINGS } from '../../../../core/strings';
import type { TenantStatusFilter } from '../data/tenant-observability-api';
import { ObservabilityStore } from '../model/observability-store';

/** Salud y uso agregado de la plataforma (HU-7.08). Solo lectura. */
@Component({
  selector: 'mapit-observability',
  imports: [RouterLink, KeyValuePipe, LocalizedDatePipe, LocalizedNumberPipe],
  providers: [ObservabilityStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './observability.html',
  styleUrl: './observability.scss',
})
export class Observability {
  protected readonly store = inject(ObservabilityStore);
  protected readonly copy = STRINGS.observability;
  protected readonly i18n = inject(I18nService);

  constructor() {
    this.store.load();
  }

  /** Un conteo suprimido se nombra, nunca se muestra como cero. */
  protected count(value: GuardedCount | undefined): string {
    if (!value) return this.copy.noData;
    return value.suppressed ? this.copy.suppressed : String(value.value ?? 0);
  }

  protected rounded(value: number): number {
    return Math.round(value);
  }

  /** Conserva el orden del servidor (ciclo de la reserva y fechas), no el alfabético. */
  protected readonly keepOrder = (): number => 0;

  protected statusLabel(status: string): string {
    const labels: Readonly<Record<string, string>> = this.copy.reservationStatuses;
    return labels[status] ?? status;
  }

  protected submit(event: Event, search: string, status: string): void {
    event.preventDefault();
    this.store.apply(search, status as TenantStatusFilter);
  }
}
