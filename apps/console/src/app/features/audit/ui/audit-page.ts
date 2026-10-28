import { DatePipe, KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, type OnInit, inject } from '@angular/core';
import type { AuditEventType, AuditResourceType } from '@mapit/api-client';

import { STRINGS } from '../../../core/strings';
import { AuditStore } from '../model/audit-store';

/** Historial de acciones de negocio visible exclusivamente para ADMIN del tenant. */
@Component({
  selector: 'mapit-audit-page',
  imports: [DatePipe, KeyValuePipe],
  providers: [AuditStore],
  templateUrl: './audit-page.html',
  styleUrl: './audit-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditPage implements OnInit {
  protected readonly store = inject(AuditStore);
  protected readonly strings = STRINGS;
  protected readonly resourceOptions: ReadonlyArray<{
    value: AuditResourceType | '';
    label: string;
  }> = [
    { value: '', label: STRINGS.audit.allResources },
    { value: 'RESERVATION', label: STRINGS.audit.resourceLabels.RESERVATION },
    { value: 'SPACE_ELEMENT', label: STRINGS.audit.resourceLabels.SPACE_ELEMENT },
  ];
  protected readonly eventOptions: ReadonlyArray<{
    value: AuditEventType | '';
    label: string;
  }> = [
    { value: '', label: STRINGS.audit.allEvents },
    { value: 'RESERVATION_CREATED', label: STRINGS.audit.eventLabels.RESERVATION_CREATED },
    {
      value: 'RESERVATION_STATUS_CHANGED',
      label: STRINGS.audit.eventLabels.RESERVATION_STATUS_CHANGED,
    },
    {
      value: 'SPACE_ELEMENT_STATE_CHANGED',
      label: STRINGS.audit.eventLabels.SPACE_ELEMENT_STATE_CHANGED,
    },
  ];

  ngOnInit(): void {
    this.store.refresh();
  }

  protected resourceLabel(value: AuditResourceType): string {
    return STRINGS.audit.resourceLabels[value];
  }

  protected eventLabel(value: AuditEventType): string {
    return STRINGS.audit.eventLabels[value];
  }

  protected detailLabel(value: string): string {
    return STRINGS.audit.detailLabels[value as keyof typeof STRINGS.audit.detailLabels] ?? value;
  }
}
