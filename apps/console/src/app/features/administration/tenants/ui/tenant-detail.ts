import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';

import { STRINGS } from '../../../../core/strings';
import { type ConfirmKind, TenantDetailStore } from '../model/tenant-detail-store';

/**
 * Detalle de un tenant: consulta, edición del nombre (único campo editable)
 * y transición de estado con confirmación. slug y vertical se muestran como
 * de solo lectura porque el dominio los declara inmutables.
 */
@Component({
  selector: 'mapit-tenant-detail',
  imports: [RouterLink, DatePipe],
  providers: [TenantDetailStore],
  templateUrl: './tenant-detail.html',
  styleUrl: './tenant-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantDetail {
  protected readonly store = inject(TenantDetailStore);
  protected readonly strings = STRINGS;
  protected editing = false;
  protected nameDraft = '';

  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  constructor() {
    effect(() => {
      const id = this.params().get('tenantId');
      if (id) this.store.load(id);
    });
  }

  protected confirmTitle(kind: ConfirmKind): string {
    const detail = this.strings.tenantDetail;
    if (kind === 'approve') return detail.confirmApproveTitle;
    return kind === 'suspend' ? detail.confirmSuspendTitle : detail.confirmReactivateTitle;
  }

  protected confirmMessage(kind: ConfirmKind): string {
    const detail = this.strings.tenantDetail;
    if (kind === 'approve') return detail.confirmApproveMessage;
    return kind === 'suspend' ? detail.confirmSuspendMessage : detail.confirmReactivateMessage;
  }

  protected startEdit(): void {
    const tenant = this.store.tenant();
    if (!tenant) return;
    this.nameDraft = tenant.name;
    this.editing = true;
  }

  protected cancelEdit(): void {
    this.editing = false;
  }

  protected saveEdit(): void {
    if (!this.nameDraft.trim()) return;
    this.store.rename(this.nameDraft);
    this.editing = false;
  }
}
