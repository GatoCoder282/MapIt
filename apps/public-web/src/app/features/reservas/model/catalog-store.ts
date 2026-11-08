import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { PublicEstablishmentSummary } from '@mapit/api-client';
import { Subject, firstValueFrom, takeUntil } from 'rxjs';
import { CatalogApi } from '../data/catalog-api';
import { STRINGS } from '../../../core/strings';
import { ActivatedRoute } from '@angular/router';
@Injectable()
export class CatalogStore {
  private readonly api = inject(CatalogApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cancel = new Subject<void>();
  private version = 0;
  readonly query = signal('');
  readonly location = signal('');
  readonly date = signal('');
  readonly people = signal('2');
  readonly selectedCategory = signal('');
  readonly order = signal('relevant');
  private readonly appliedLocation = signal('');
  readonly tenantSlug = signal(
    inject(ActivatedRoute, { optional: true })?.snapshot.queryParamMap.get('tenantSlug') ?? '',
  );
  readonly offset = signal(0);
  readonly pageSize = 6;
  readonly items = signal<readonly PublicEstablishmentSummary[]>([]);
  readonly status = signal<'loading' | 'loaded' | 'error'>('loading');
  // shortcut: filtros sobre la página recibida; moverlos al servidor cuando el contrato los admita.
  readonly visibleItems = computed(() => {
    const location = this.appliedLocation().trim().toLocaleLowerCase();
    const category = this.selectedCategory();
    const items = this.items().filter(
      (item) =>
        (!location || item.address?.toLocaleLowerCase().includes(location)) &&
        (!category || this.category(item.type) === (category === 'salones' ? 'eventos' : category)),
    );
    return this.order() === 'name' ? items.sort((a, b) => a.name.localeCompare(b.name)) : items;
  });
  readonly locations = computed(() =>
    [...new Set(this.items().flatMap((item) => (item.address ? [item.address] : [])))].sort(),
  );
  readonly bookingCriteria = computed(() => ({ date: this.date(), people: this.people() }));
  constructor() {
    this.destroyRef.onDestroy(() => {
      this.version++;
      this.cancel.next();
      this.cancel.complete();
    });
    void this.search();
  }
  async search(reset = true): Promise<void> {
    if (reset) {
      this.offset.set(0);
      this.appliedLocation.set(this.location());
    }
    const version = ++this.version;
    this.cancel.next();
    this.status.set('loading');
    this.items.set([]);
    try {
      const items = await firstValueFrom(
        this.api
          .list(this.query().trim(), this.tenantSlug(), this.pageSize, this.offset())
          .pipe(takeUntil(this.cancel), takeUntilDestroyed(this.destroyRef)),
      );
      if (version !== this.version) return;
      this.items.set(items);
      this.status.set('loaded');
    } catch {
      if (version === this.version) this.status.set('error');
    }
  }
  selectCategory(category: string): void {
    this.selectedCategory.update((current) => (current === category ? '' : category));
  }
  next(): void {
    if (this.status() !== 'loading' && this.items().length === this.pageSize) {
      this.offset.update((value) => value + this.pageSize);
      void this.search(false);
    }
  }
  previous(): void {
    if (this.status() !== 'loading' && this.offset() > 0) {
      this.offset.update((value) => Math.max(0, value - this.pageSize));
      void this.search(false);
    }
  }
  category(type: string): string {
    return (
      (
        {
          RESTAURANT: 'restaurante',
          NIGHTCLUB: 'discoteca',
          EVENT_HALL: 'eventos',
          HOTEL: 'hotel',
        } as Record<string, string>
      )[type] ?? 'otros'
    );
  }
  typeLabel(type: string): string {
    const labels: Readonly<Record<string, string>> = STRINGS.publicCatalog.types;
    return labels[type] ?? type;
  }
}
