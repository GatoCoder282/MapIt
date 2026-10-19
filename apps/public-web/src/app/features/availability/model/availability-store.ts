import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { PublicAvailabilityElement } from '@mapit/api-client';

import { AvailabilityApi } from '../data/availability-api';

export type AvailabilityStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** Estado de búsqueda aislado de la vista para cubrir resultados y fallos. */
@Injectable()
export class AvailabilityStore {
  private readonly api = inject(AvailabilityApi);
  private requestVersion = 0;

  readonly status = signal<AvailabilityStatus>('idle');
  readonly elements = signal<readonly PublicAvailabilityElement[]>([]);
  readonly date = signal('');

  async search(tenantSlug: string, establishmentSlug: string, date: string): Promise<void> {
    const requestVersion = ++this.requestVersion;
    this.date.set(date);
    this.elements.set([]);
    this.status.set('loading');

    try {
      const availability = await firstValueFrom(this.api.find(tenantSlug, establishmentSlug, date));
      if (requestVersion !== this.requestVersion) return;
      this.elements.set(availability.elements);
      this.status.set('loaded');
    } catch {
      if (requestVersion !== this.requestVersion) return;
      this.elements.set([]);
      this.status.set('error');
    }
  }

  reset(): void {
    this.requestVersion += 1;
    this.elements.set([]);
    this.date.set('');
    this.status.set('idle');
  }
}
