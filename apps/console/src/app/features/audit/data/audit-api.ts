import { Injectable, inject } from '@angular/core';
import { AuditService } from '@mapit/api-client';
import type { AuditEventType, AuditLogPage, AuditResourceType } from '@mapit/api-client';
import type { Observable } from 'rxjs';

export interface AuditQuery {
  resourceType?: AuditResourceType;
  eventType?: AuditEventType;
  resourceId?: string;
  from?: string;
  to?: string;
  page: number;
  size: number;
}

/** Adaptador entre el ViewModel de auditoría y el cliente generado desde OpenAPI. */
@Injectable({ providedIn: 'root' })
export class AuditApi {
  private readonly client = inject(AuditService);

  list(query: AuditQuery): Observable<AuditLogPage> {
    return this.client.listAuditLogs(query);
  }
}
