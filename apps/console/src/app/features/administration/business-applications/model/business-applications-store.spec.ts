import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BusinessApplicationsApi } from '../data/business-applications-api';
import { BusinessApplicationsStore } from './business-applications-store';

describe('BusinessApplicationsStore', () => {
  it('filtra pendientes y reinicia la página al cambiar la búsqueda', () => {
    const list = vi.fn(() =>
      of({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
    );
    TestBed.configureTestingModule({
      providers: [
        BusinessApplicationsStore,
        { provide: BusinessApplicationsApi, useValue: { list } },
      ],
    });
    const store = TestBed.inject(BusinessApplicationsStore);
    store.changePage(2);
    store.filter('Hotel', 'PENDING');
    expect(store.page()).toBe(0);
    expect(list).toHaveBeenLastCalledWith('Hotel', 'PENDING', 0);
    expect(store.result()?.totalElements).toBe(0);
  });

  it('actualiza el detalle después de aprobar sin duplicar la acción', () => {
    const approved = { id: 'request-1', status: 'APPROVED', approvedTenantId: 'tenant-1' };
    const approve = vi.fn(() => of(approved));
    TestBed.configureTestingModule({
      providers: [
        BusinessApplicationsStore,
        { provide: BusinessApplicationsApi, useValue: { approve } },
      ],
    });
    const store = TestBed.inject(BusinessApplicationsStore);
    store.approve('request-1', 'tenant-1');
    expect(approve).toHaveBeenCalledWith('request-1', 'tenant-1');
    expect(store.selected()?.status).toBe('APPROVED');
    expect(store.deciding()).toBe(false);
    expect(store.decisionError()).toBe(false);
  });
});
