import { ChangeDetectionStrategy, Component, computed, type OnInit, inject } from '@angular/core';
import { I18nService, LocalizedDatePipe } from '@mapit/i18n';
import { RouterLink } from '@angular/router';
import type { TenantStatus } from '@mapit/api-client';

import { localizeString, STRINGS } from '../../../../core/strings';
import { TenantsListStore } from '../model/tenants-list-store';

/** Listado paginado de tenants de la plataforma (SUPER_ADMIN). */
@Component({
  selector: 'mapit-tenant-list',
  imports: [RouterLink, LocalizedDatePipe],
  providers: [TenantsListStore],
  templateUrl: './tenant-list.html',
  styleUrl: './tenant-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantList implements OnInit {
  protected readonly localizeString = localizeString;
  protected readonly locale = inject(I18nService).locale;
  protected readonly store = inject(TenantsListStore);
  protected readonly strings = STRINGS;
  protected readonly statusFilters = computed<
    ReadonlyArray<{ value: TenantStatus | ''; label: string }>
  >(() => [
    { value: '', label: STRINGS.tenants.allStatuses },
    { value: 'ACTIVE', label: STRINGS.tenants.statusLabels.ACTIVE },
    { value: 'SUSPENDED', label: STRINGS.tenants.statusLabels.SUSPENDED },
  ]);

  ngOnInit(): void {
    this.store.refresh();
  }

  protected statusLabel(status: TenantStatus): string {
    return STRINGS.tenants.statusLabels[status];
  }
}
