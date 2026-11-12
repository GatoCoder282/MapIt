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
    list.mockReturnValue(of(Array.from({ length: 6 }, (_, i) => ({ ...VENUE, id: String(i) }))));
    await store.search();
    store.next();
    await Promise.resolve();
    expect(list).toHaveBeenLastCalledWith('', 'empresa-real', 6, 6);
    store.query.set('Norte');
    await store.search();
    expect(list).toHaveBeenLastCalledWith('Norte', 'empresa-real', 6, 0);
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
  it('filtra direcciones y categorías reales y ordena sin alterar los datos de la API', async () => {
    const venues = [
      { ...VENUE, id: 'z', name: 'Zeta', address: 'Centro, La Paz' },
      { ...VENUE, id: 'a', name: 'Alfa', address: 'Centro, La Paz' },
      { ...VENUE, id: 'h', type: 'HOTEL', address: 'Norte, Santa Cruz' },
      { ...VENUE, id: 's', type: 'EVENT_HALL', address: 'Centro, La Paz' },
    ];
    list.mockReturnValue(of(venues));
    store.location.set('LA PAZ');
    await store.search();
    store.selectCategory('restaurante');
    store.order.set('name');
    expect(store.visibleItems().map((venue) => venue.name)).toEqual(['Alfa', 'Zeta']);
    expect(store.items()).toEqual(venues);
    store.selectCategory('salones');
    expect(store.visibleItems().map((venue) => venue.id)).toEqual(['s']);
    store.selectCategory('salones');
    expect(store.visibleItems()).toHaveLength(3);
  });
  it('mantiene fecha y personas para consultar disponibilidad, sin inventar disponibilidad', () => {
    store.date.set('2026-12-10');
    store.people.set('4');
    expect(store.bookingCriteria()).toEqual({ date: '2026-12-10', people: '4' });
    store.items.set([{ ...VENUE, type: 'UNKNOWN' }]);
    store.selectCategory('otros');
    expect(store.visibleItems()).toHaveLength(1);
    store.selectCategory('hotel');
    expect(store.visibleItems()).toEqual([]);
  });
});
