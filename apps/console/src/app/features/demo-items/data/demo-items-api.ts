import { Injectable, inject } from '@angular/core';
import { DemoItemsService } from '@mapit/api-client';
import type { DemoItem, DemoItemRequest } from '@mapit/api-client';
import type { Observable } from 'rxjs';

/** Adaptador de datos del CRUD: la feature solo conoce este API tipado. */
@Injectable({ providedIn: 'root' })
export class DemoItemsApi {
  private readonly client = inject(DemoItemsService);

  list(): Observable<DemoItem[]> {
    return this.client.listDemoItems();
  }

  create(request: DemoItemRequest): Observable<DemoItem> {
    return this.client.createDemoItem({ demoItemRequest: request });
  }

  update(id: string, request: DemoItemRequest): Observable<DemoItem> {
    return this.client.updateDemoItem({ id, demoItemRequest: request });
  }

  delete(id: string): Observable<unknown> {
    return this.client.deleteDemoItem({ id });
  }
}
