import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { AuditLogEntry, AuditLogPage } from '@mapit/api-client';
import { Subject, of, throwError } from 'rxjs';

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

function pageOf(content: AuditLogEntry[], page = 0, totalPages = 1, size = 10): AuditLogPage {
  return { content, page, size, totalElements: content.length, totalPages };
}

describe('AuditStore', () => {
  let store: AuditStore;
  const list = vi.fn<AuditApi['list']>();
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
    const start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    expect(list).toHaveBeenCalledWith({ page: 0, size: 10, from: start.toISOString() });
  });

  it('aplica filtros y vuelve a la primera página', () => {
    store.refresh(2);
    store.updateFilter('resourceType', 'RESERVATION');
    store.updateFilter('resourceId', '  ' + ENTRY.resourceId + '  ');
    store.updatePeriod('custom');
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
    expect(list).toHaveBeenLastCalledWith({ page: 0, size: 10 });
  });

  it('pagina con los filtros aplicados, sin usar cambios pendientes', () => {
    list.mockReturnValue(of(pageOf([ENTRY], 0, 3)));
    store.updatePeriod('all');
    store.updateFilter('resourceType', 'RESERVATION');
    store.applyFilters();
    store.updateFilter('resourceType', 'SPACE_ELEMENT');

    store.goNext();

    expect(list).toHaveBeenLastCalledWith({ page: 1, size: 10, resourceType: 'RESERVATION' });
  });

  it('reinicia la página al cambiar el tamaño', () => {
    store.refresh(3);
    list.mockReturnValue(of(pageOf([ENTRY], 0, 1, 50)));

    store.setPageSize(50);

    expect(list.mock.lastCall?.[0]).toMatchObject({ page: 0, size: 50 });
    expect(store.page()).toBe(0);
  });

  it('evita consultas con identificadores incompletos e intervalos inválidos', () => {
    store.updateFilter('resourceId', '34e8f789');
    store.applyFilters();
    expect(store.filterError()).toBe(STRINGS.audit.invalidResourceId);

    store.updateFilter('resourceId', '');
    store.updatePeriod('custom');
    store.updateFilter('from', '2026-10-30');
    store.updateFilter('to', '2026-10-28');
    store.applyFilters();

    expect(store.filterError()).toBe(STRINGS.audit.invalidPeriod);
    expect(list).not.toHaveBeenCalled();
  });

  it('conserva el detalle si el evento sigue visible y descarta respuestas tardías', () => {
    store.refresh();
    store.select(ENTRY.id);
    store.refresh();
    expect(store.selectedEntry()?.id).toBe(ENTRY.id);

    const older = new Subject<AuditLogPage>();
    const latest = new Subject<AuditLogPage>();
    list.mockReturnValueOnce(older).mockReturnValueOnce(latest);
    store.refresh();
    store.clearFilters();

    latest.next(pageOf([], 0, 0));
    latest.complete();
    older.next(pageOf([ENTRY]));
    older.complete();

    expect(store.isEmpty()).toBe(true);
    expect(store.selectedId()).toBeNull();
  });
});
