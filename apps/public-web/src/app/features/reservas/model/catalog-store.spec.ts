import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError, type Observable } from 'rxjs';
import type { PublicEstablishmentSummary } from '@mapit/api-client';
import { CatalogApi } from '../data/catalog-api';
import { CatalogStore } from './catalog-store';
const VENUE: PublicEstablishmentSummary = {
  id: 'venue-a',
  name: 'Local real',
  tenantName: 'Empresa real',
  type: 'RESTAURANT',
  address: null,
  tenantSlug: 'tenant-a',
  establishmentSlug: 'venue-a',
  timezone: 'America/La_Paz',
};
describe('CatalogStore', () => {
  const list = vi.fn<() => Observable<PublicEstablishmentSummary[]>>(() => of([VENUE]));
  let store: CatalogStore;
  beforeEach(() => {
    list.mockReset();
    list.mockReturnValue(of([VENUE]));
    TestBed.configureTestingModule({
      providers: [CatalogStore, { provide: CatalogApi, useValue: { list } }],
    });
    store = TestBed.inject(CatalogStore);
  });
  it('no sustituye un error por establecimientos ficticios y permite reintento vacío', async () => {
    list.mockReturnValue(throwError(() => new Error('offline')));
    await store.search();
    expect(store.status()).toBe('error');
    expect(store.items()).toEqual([]);
    list.mockReturnValue(of([]));
    await store.search();
    expect(store.status()).toBe('loaded');
    expect(store.items()).toEqual([]);
  });
  it('mantiene la empresa al buscar y paginar y reinicia la página al filtrar', async () => {
    store.tenantSlug.set('empresa-real');
    list.mockReturnValue(of(Array.from({ length: 20 }, (_, i) => ({ ...VENUE, id: String(i) }))));
    await store.search();
    store.next();
    await Promise.resolve();
    expect(list).toHaveBeenLastCalledWith('', 'empresa-real', 20, 20);
    store.query.set('Norte');
    await store.search();
    expect(list).toHaveBeenLastCalledWith('Norte', 'empresa-real', 20, 0);
  });
  it('cancela resultados de una búsqueda anterior al cambiar de consulta', async () => {
    const old = new Subject<PublicEstablishmentSummary[]>();
    list.mockReturnValueOnce(old);
    const pending = store.search();
    store.query.set('nuevo');
    list.mockReturnValue(of([]));
    await store.search();
    expect(old.observed).toBe(false);
    old.next([VENUE]);
    await pending;
    expect(store.items()).toEqual([]);
    expect(store.status()).toBe('loaded');
  });
});
