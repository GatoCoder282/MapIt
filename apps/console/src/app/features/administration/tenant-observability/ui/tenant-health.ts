import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { GuardedCount } from '@mapit/api-client';

import { STRINGS } from '../../../../core/strings';
import { TenantHealthStore } from '../model/tenant-health-store';

/** Detalle agregado de una empresa: sin reservas, clientes, pagos ni personal. */
@Component({
  selector: 'mapit-tenant-health',
  imports: [RouterLink, KeyValuePipe],
  providers: [TenantHealthStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tenant-health.html',
  styleUrl: './observability.scss',
})
export class TenantHealthPage {
  readonly slug = input.required<string>();
  protected readonly store = inject(TenantHealthStore);
  protected readonly copy = STRINGS.observability;

  constructor() {
    effect(() => {
      const slug = this.slug();
      untracked(() => this.store.open(slug));
    });
  }

  protected count(value: GuardedCount | undefined): string {
    if (!value) return this.copy.noData;
    return value.suppressed ? this.copy.suppressed : String(value.value ?? 0);
  }

  /** Conserva el orden del servidor (ciclo de la reserva y fechas), no el alfabético. */
  protected readonly keepOrder = (): number => 0;

  protected statusLabel(status: string): string {
    const labels: Readonly<Record<string, string>> = this.copy.reservationStatuses;
    return labels[status] ?? status;
  }

  protected verticalLabel(vertical: string): string {
    const labels: Readonly<Record<string, string>> = STRINGS.verticals;
    return labels[vertical] ?? vertical;
  }
}
