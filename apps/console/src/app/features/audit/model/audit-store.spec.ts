import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { AuditLogEntry, AuditLogPage } from '@mapit/api-client';
import { of, throwError } from 'rxjs';

import { STRINGS } from '../../../core/strings';
import { AuditApi } from '../data/audit-api';
import { AuditStore } from './audit-store';

const ENTRY: AuditLogEntry = {
  id: '152efff5-b2b3-4774-9ba4-36d8a3101725',
  actorId: 'ee84dc82-7485-4672-9684-f31c769e1119',
  occurredAt: '2026-10-24T15:30:00Z',
  resourceType: 'RESERVATION',
  resourceId: '34e8f789-ee31-44e1-a392-62be58e117d5',
  eventType: 'RESERVATION_CREATED',
  details: { initialStatus: 'CREATED' },
};

function pageOf(content: AuditLogEntry[], page = 0, totalPages = 1): AuditLogPage {
  return { content, page, size: 20, totalElements: content.length, totalPages };
}

describe('AuditStore', () => {
  let store: AuditStore;
  const list = vi.fn((_: unknown) => of(pageOf([ENTRY])));
  const api = { list } as unknown as AuditApi;

  beforeEach(() => {
    list.mockClear();
    list.mockReturnValue(of(pageOf([ENTRY])));
    TestBed.configureTestingModule({
      providers: [AuditStore, { provide: AuditApi, useValue: api }],
    });
    store = TestBed.inject(AuditStore);
  });

  it('carga la primera página y expone sus eventos', () => {
    store.refresh();

    expect(store.status()).toBe('ready');
    expect(store.entries()).toEqual([ENTRY]);
    expect(list).toHaveBeenCalledWith({ page: 0, size: 20 });
  });

  it('aplica filtros y vuelve a la primera página', () => {
    store.refresh(2);
    store.updateFilter('resourceType', 'RESERVATION');
    store.updateFilter('resourceId', '  ' + ENTRY.resourceId + '  ');
    store.updateFilter('from', '2026-10-20');
    store.applyFilters();

    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 0,
        resourceType: 'RESERVATION',
        resourceId: ENTRY.resourceId,
        from: new Date('2026-10-20T00:00:00.000').toISOString(),
      }),
    );
  });

  it('conserva los filtros útiles cuando la consulta falla', () => {
    list.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Error' })),
    );
    store.updateFilter('eventType', 'SPACE_ELEMENT_STATE_CHANGED');

    store.applyFilters();

    expect(store.status()).toBe('error');
    expect(store.errorMessage()).toBe(STRINGS.audit.error);
    expect(store.filters().eventType).toBe('SPACE_ELEMENT_STATE_CHANGED');
  });

  it('distingue un error de autorización', () => {
    list.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' })),
    );

    store.refresh();

    expect(store.errorMessage()).toBe(STRINGS.audit.forbidden);
  });

  it('limpia filtros y consulta nuevamente', () => {
    store.updateFilter('resourceType', 'SPACE_ELEMENT');
    store.updateFilter('to', '2026-10-24');

    store.clearFilters();

    expect(store.filters()).toEqual({
      resourceType: '',
      eventType: '',
      resourceId: '',
      from: '',
      to: '',
    });
    expect(list).toHaveBeenLastCalledWith({ page: 0, size: 20 });
  });

  it('pagina sin perder los filtros activos', () => {
    list.mockReturnValue(of(pageOf([ENTRY], 0, 3)));
    store.updateFilter('resourceType', 'RESERVATION');
    store.refresh();

    store.goNext();

    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, resourceType: 'RESERVATION' }),
    );
  });
});
